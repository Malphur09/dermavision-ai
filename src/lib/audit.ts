import { createClient } from "@/lib/supabase/client";

export async function logPhiAccess(params: {
  resource_type: string;
  resource_id: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from("audit_logs").insert({
    user_id: user.id,
    resource_type: params.resource_type,
    resource_id: params.resource_id,
    action: params.action,
    metadata: params.metadata ?? null,
  });
  if (error) {
    console.error("[audit] insert failed", error, params);
  }
}
