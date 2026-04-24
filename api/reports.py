"""Report export endpoint.

Renders a case as PDF (via WeasyPrint) or JSON, uploads the file to the
`reports` storage bucket under the caller's folder, inserts a row in
`public.reports`, and returns a short-lived signed URL.

Gated by @require_user — every Supabase request is made with the caller's
own JWT so RLS enforces ownership (no service-role bypass).
"""

from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from typing import Any

import requests
from flask import Blueprint, Response, jsonify, request

from api._auth import SUPABASE_ANON_KEY, SUPABASE_URL, require_user

reports_bp = Blueprint("reports", __name__, url_prefix="/api/reports")

BUCKET = "reports"
IMAGE_BUCKET = "dermoscopic-images"
HEATMAP_BUCKET = "heatmaps"
SIGNED_URL_TTL_SECONDS = 60 * 60  # 1 hour

CLASS_DISPLAY = {
    "Melanoma": ("High Risk", "Malignant skin cancer requiring urgent dermatologic referral and likely biopsy."),
    "Basal Cell Carcinoma": ("High Risk", "Most common skin cancer; typically slow-growing. Refer for excision or Mohs surgery."),
    "Squamous Cell Carcinoma": ("High Risk", "Malignant; risk of metastasis if neglected. Refer for excision."),
    "Actinic Keratosis": ("Moderate Risk", "Precancerous lesion. Consider cryotherapy, topical therapy, or biopsy if atypical."),
    "Melanocytic Nevus": ("Benign", "Common benign mole. Monitor for ABCDE changes."),
    "Benign Keratosis": ("Benign", "Benign epidermal proliferation. No treatment typically required."),
    "Dermatofibroma": ("Benign", "Benign fibrous nodule. Excise only if symptomatic."),
    "Vascular Lesion": ("Benign", "Benign vascular proliferation. Cosmetic treatment optional."),
}


def _caller() -> dict:
    return request.environ["caller"]  # { user, token }


def _user_headers(token: str, content_type: str | None = "application/json") -> dict:
    headers = {
        "apikey": SUPABASE_ANON_KEY or "",
        "Authorization": f"Bearer {token}",
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def _fetch_case(token: str, case_id: str) -> dict | None:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/cases",
        params={
            "id": f"eq.{case_id}",
            "select": "*,patient:patients(patient_id,name,age,sex)",
        },
        headers=_user_headers(token, None),
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    return rows[0] if rows else None


def _fetch_user_details(token: str, user_id: str) -> dict | None:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/user_details",
        params={
            "id": f"eq.{user_id}",
            "select": "full_name,specialty,license,clinic_name",
        },
        headers=_user_headers(token, None),
        timeout=5,
    )
    if resp.status_code != 200:
        return None
    rows = resp.json()
    return rows[0] if rows else None


def _fetch_storage_object(token: str, bucket: str, path: str) -> bytes | None:
    if not path:
        return None
    resp = requests.get(
        f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}",
        headers={
            "apikey": SUPABASE_ANON_KEY or "",
            "Authorization": f"Bearer {token}",
        },
        timeout=15,
    )
    if resp.status_code != 200:
        return None
    return resp.content


def _image_data_url(data: bytes | None, mime: str = "image/jpeg") -> str | None:
    if not data:
        return None
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


def _risk_class(pred: str | None) -> tuple[str, str]:
    if not pred:
        return ("Unknown", "No prediction available.")
    return CLASS_DISPLAY.get(pred, ("Unknown", "No guidance available for this class."))


def _build_html(case: dict, user: dict, user_details: dict | None, sections: dict,
                image_b64: str | None, gradcam_b64: str | None) -> str:
    patient = case.get("patient") or {}
    pred = case.get("predicted_class")
    risk_level, risk_note = _risk_class(pred)
    confidence = case.get("confidence")
    if isinstance(confidence, (int, float)):
        confidence_pct = f"{float(confidence) * 100:.1f}%" if confidence <= 1 else f"{float(confidence):.1f}%"
    else:
        confidence_pct = "—"

    probs = case.get("probabilities") or {}
    # Sort desc
    prob_rows = sorted(
        ((k, float(v)) for k, v in probs.items()),
        key=lambda kv: kv[1],
        reverse=True,
    )

    doctor_name = (user_details or {}).get("full_name") or user.get("email", "—")
    clinic = (user_details or {}).get("clinic_name") or ""
    license_no = (user_details or {}).get("license") or ""
    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    risk_color = {
        "High Risk": "#dc2626",
        "Moderate Risk": "#d97706",
        "Benign": "#16a34a",
    }.get(risk_level, "#64748b")

    patient_block = ""
    if sections.get("patientInfo"):
        patient_block = f"""
        <section class="card">
          <h2>Patient</h2>
          <dl>
            <dt>Patient ID</dt><dd>{patient.get('patient_id') or '—'}</dd>
            <dt>Name</dt><dd>{patient.get('name') or '—'}</dd>
            <dt>Age</dt><dd>{patient.get('age') if patient.get('age') is not None else '—'}</dd>
            <dt>Sex</dt><dd>{(patient.get('sex') or '—').title()}</dd>
            <dt>Lesion site</dt><dd>{case.get('lesion_site') or '—'}</dd>
          </dl>
        </section>
        """

    diagnosis_block = ""
    if sections.get("diagnosisResults"):
        prob_html = "".join(
            f"<tr><td>{c}</td><td class='num'>{(p * 100 if p <= 1 else p):.1f}%</td></tr>"
            for c, p in prob_rows
        ) or "<tr><td colspan='2' class='muted'>No probabilities recorded.</td></tr>"
        diagnosis_block = f"""
        <section class="card">
          <h2>Diagnosis</h2>
          <div class="diag-row">
            <div class="diag-main">
              <div class="label">Primary prediction</div>
              <div class="pred">{pred or '—'}</div>
              <div class="sub"><span class="chip" style="background:{risk_color}22;color:{risk_color};border-color:{risk_color}66">{risk_level}</span> · Confidence {confidence_pct}</div>
            </div>
          </div>
          <table class="probs">
            <thead><tr><th>Class</th><th class="num">Probability</th></tr></thead>
            <tbody>{prob_html}</tbody>
          </table>
        </section>
        """

    gradcam_block = ""
    if sections.get("gradCAM"):
        if image_b64 or gradcam_b64:
            imgs = ""
            if image_b64:
                imgs += f'<figure><img src="{image_b64}" alt="Lesion"/><figcaption>Original dermoscopic image</figcaption></figure>'
            if gradcam_b64:
                imgs += f'<figure><img src="{gradcam_b64}" alt="Grad-CAM overlay"/><figcaption>Grad-CAM attribution overlay</figcaption></figure>'
            gradcam_block = f"""
            <section class="card">
              <h2>Explainability</h2>
              <div class="figures">{imgs}</div>
              <p class="muted small">Heatmap highlights regions most influential to the prediction.</p>
            </section>
            """
        else:
            gradcam_block = """
            <section class="card">
              <h2>Explainability</h2>
              <p class="muted">No images available for this case.</p>
            </section>
            """

    reco_block = ""
    if sections.get("recommendations"):
        reco_block = f"""
        <section class="card">
          <h2>Clinical guidance</h2>
          <p>{risk_note}</p>
          <ul class="muted small">
            <li>Confirm with clinical examination and histopathology where indicated.</li>
            <li>Document dermoscopic findings (ABCDE, 7-point checklist) alongside AI output.</li>
            <li>Consider repeat imaging at follow-up to assess change over time.</li>
          </ul>
        </section>
        """

    tech_block = ""
    if sections.get("technicalDetails"):
        tech_block = f"""
        <section class="card">
          <h2>Technical</h2>
          <dl>
            <dt>Case ID</dt><dd class="mono">{case.get('id')}</dd>
            <dt>Status</dt><dd>{case.get('status') or '—'}</dd>
            <dt>Captured</dt><dd>{case.get('created_at') or '—'}</dd>
            <dt>Model</dt><dd>EfficientNet-B4 · ISIC 2019 (8 classes)</dd>
          </dl>
        </section>
        """

    return f"""<!doctype html>
<html><head><meta charset="utf-8"/><title>Diagnostic report {case.get('id')}</title>
<style>
  @page {{ size: A4; margin: 18mm 16mm 22mm 16mm;
    @bottom-center {{ content: "DermaVision AI · page " counter(page) " of " counter(pages);
      font-family: -apple-system, Helvetica, sans-serif; font-size: 8pt; color: #94a3b8; }} }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 10pt; line-height: 1.45; }}
  h1 {{ font-size: 18pt; margin: 0 0 4pt; letter-spacing: -0.01em; }}
  h2 {{ font-size: 11pt; margin: 0 0 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt; }}
  .mono {{ font-family: "SF Mono", Menlo, monospace; font-size: 9pt; }}
  .muted {{ color: #64748b; }}
  .small {{ font-size: 9pt; }}
  header.doc-header {{ display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10pt; margin-bottom: 14pt; }}
  header.doc-header .brand {{ font-weight: 600; letter-spacing: -0.01em; }}
  header.doc-header .brand .sub {{ font-size: 8.5pt; color: #64748b; font-weight: 400; margin-top: 2pt; }}
  header.doc-header .meta {{ text-align: right; font-size: 9pt; color: #475569; }}
  .card {{ border: 1px solid #e2e8f0; border-radius: 6pt; padding: 12pt 14pt; margin-bottom: 10pt; page-break-inside: avoid; }}
  dl {{ display: grid; grid-template-columns: 110pt 1fr; gap: 4pt 10pt; margin: 0; }}
  dt {{ color: #64748b; font-size: 9pt; }}
  dd {{ margin: 0; font-weight: 500; }}
  .diag-row {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10pt; }}
  .diag-main .label {{ font-size: 8.5pt; text-transform: uppercase; color: #64748b; letter-spacing: 0.06em; }}
  .diag-main .pred {{ font-size: 16pt; font-weight: 600; margin-top: 2pt; }}
  .diag-main .sub {{ margin-top: 4pt; font-size: 9.5pt; color: #475569; }}
  .chip {{ display: inline-block; padding: 2pt 7pt; border-radius: 999pt; font-size: 8.5pt; font-weight: 600; border: 1px solid transparent; }}
  table.probs {{ width: 100%; border-collapse: collapse; margin-top: 4pt; }}
  table.probs th, table.probs td {{ padding: 5pt 6pt; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 9.5pt; }}
  table.probs th {{ color: #64748b; font-weight: 500; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.06em; }}
  .num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .figures {{ display: flex; gap: 12pt; }}
  .figures figure {{ margin: 0; flex: 1; text-align: center; }}
  .figures img {{ width: 100%; max-height: 180pt; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 4pt; }}
  .figures figcaption {{ font-size: 8.5pt; color: #64748b; margin-top: 4pt; }}
  ul {{ margin: 6pt 0 0; padding-left: 16pt; }}
  ul li {{ margin-bottom: 3pt; }}
  footer.doc-footer {{ margin-top: 14pt; padding-top: 10pt; border-top: 1px solid #e2e8f0; font-size: 8.5pt; color: #64748b; }}
  footer.doc-footer strong {{ color: #0f172a; }}
</style></head>
<body>
  <header class="doc-header">
    <div class="brand">
      DermaVision AI
      <div class="sub">Dermatologic decision support · Diagnostic report</div>
    </div>
    <div class="meta">
      <div><strong>{doctor_name}</strong></div>
      {f'<div>{clinic}</div>' if clinic else ''}
      {f'<div>SCFHS {license_no}</div>' if license_no else ''}
      <div class="mono">{generated_at}</div>
    </div>
  </header>
  {patient_block}
  {diagnosis_block}
  {gradcam_block}
  {reco_block}
  {tech_block}
  <footer class="doc-footer">
    <strong>Not a diagnostic device.</strong> Intended for clinical decision support only.
    AI predictions must be confirmed through clinical evaluation and histopathology when indicated.
  </footer>
</body></html>
"""


def _render_pdf(html: str) -> bytes:
    from weasyprint import HTML
    return HTML(string=html).write_pdf()


def _render_json(case: dict, user: dict, sections: dict) -> bytes:
    payload: dict[str, Any] = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "doctor": {"id": user.get("id"), "email": user.get("email")},
        "sections": sections,
        "case": case,
    }
    return json.dumps(payload, indent=2, default=str).encode("utf-8")


def _upload_file(token: str, path: str, data: bytes, content_type: str) -> bool:
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers={
            "apikey": SUPABASE_ANON_KEY or "",
            "Authorization": f"Bearer {token}",
            "Content-Type": content_type,
            "x-upsert": "true",
        },
        data=data,
        timeout=30,
    )
    return resp.status_code in (200, 201)


def _insert_report(token: str, row: dict) -> dict | None:
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/reports",
        headers={**_user_headers(token), "Prefer": "return=representation"},
        json=row,
        timeout=10,
    )
    if resp.status_code not in (200, 201):
        return None
    rows = resp.json()
    return rows[0] if rows else None


def _sign_url(token: str, path: str) -> str | None:
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
        headers=_user_headers(token),
        json={"expiresIn": SIGNED_URL_TTL_SECONDS},
        timeout=10,
    )
    if resp.status_code != 200:
        return None
    body = resp.json()
    signed = body.get("signedURL") or body.get("signedUrl")
    if not signed:
        return None
    return f"{SUPABASE_URL}/storage/v1{signed}" if signed.startswith("/") else signed


@reports_bp.post("/export")
@require_user
def export_report() -> Response:
    caller = _caller()
    user = caller["user"]
    token = caller["token"]

    body = request.get_json(silent=True) or {}
    case_id = body.get("case_id")
    fmt = (body.get("format") or "pdf").lower()
    sections = body.get("sections") or {}
    if not case_id:
        return jsonify({"error": "case_id required"}), 400
    if fmt not in ("pdf", "json"):
        return jsonify({"error": "format must be 'pdf' or 'json'"}), 400
    if not isinstance(sections, dict):
        return jsonify({"error": "sections must be an object"}), 400

    case = _fetch_case(token, case_id)
    if not case:
        return jsonify({"error": "case not found"}), 404
    if case.get("doctor_id") != user.get("id"):
        return jsonify({"error": "forbidden"}), 403

    if fmt == "pdf":
        user_details = _fetch_user_details(token, user["id"])
        image_b64 = None
        gradcam_b64 = None
        if sections.get("gradCAM"):
            image_bytes = _fetch_storage_object(token, IMAGE_BUCKET, case.get("image_url") or "")
            gradcam_bytes = _fetch_storage_object(token, HEATMAP_BUCKET, case.get("gradcam_url") or "")
            image_b64 = _image_data_url(image_bytes, "image/jpeg")
            gradcam_b64 = _image_data_url(gradcam_bytes, "image/png")
        html = _build_html(case, user, user_details, sections, image_b64, gradcam_b64)
        data = _render_pdf(html)
        content_type = "application/pdf"
        ext = "pdf"
    else:
        data = _render_json(case, user, sections)
        content_type = "application/json"
        ext = "json"

    file_id = uuid.uuid4().hex
    path = f"{user['id']}/{file_id}.{ext}"
    if not _upload_file(token, path, data, content_type):
        return jsonify({"error": "upload failed"}), 502

    row = _insert_report(
        token,
        {
            "case_id": case_id,
            "doctor_id": user["id"],
            "sections": sections,
            "format": fmt,
            "file_url": path,
        },
    )
    if not row:
        return jsonify({"error": "failed to record report"}), 502

    signed = _sign_url(token, path)
    if not signed:
        return jsonify({"error": "failed to sign url"}), 502

    return jsonify(
        {
            "report_id": row.get("id"),
            "format": fmt,
            "file_url": path,
            "signed_url": signed,
        }
    )
