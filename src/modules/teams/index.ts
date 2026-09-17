import "server-only";
import { createClient as createServerClient } from "@/core/supabase/server";

export type TeamMember = { employee_id: string; first_name: string; last_name: string };
export type Team = {
  id: string;
  name: string;
  team_lead_id: string | null;
  lead: { first_name: string; last_name: string } | null;
  members: TeamMember[];
};

export async function listTeams(): Promise<Team[]> {
  const supabase = await createServerClient();
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, team_lead_id, lead:employees!teams_team_lead_id_fkey(first_name, last_name)")
    .order("name");
  const { data: members } = await supabase
    .from("team_members")
    .select("team_id, employee:employees(id, first_name, last_name)");

  const byTeam = new Map<string, TeamMember[]>();
  for (const m of (members ?? []) as unknown[]) {
    const row = m as { team_id: string; employee: { id: string; first_name: string; last_name: string } | { id: string; first_name: string; last_name: string }[] | null };
    if (!row.employee) continue;
    const emp = Array.isArray(row.employee) ? row.employee[0] : row.employee;
    if (!emp) continue;
    const arr = byTeam.get(row.team_id) ?? [];
    arr.push({ employee_id: emp.id, first_name: emp.first_name, last_name: emp.last_name });
    byTeam.set(row.team_id, arr);
  }

  return ((teams ?? []) as unknown[]).map((t) => {
    const row = t as { id: string; name: string; team_lead_id: string | null; lead: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null };
    const lead = Array.isArray(row.lead) ? row.lead[0] ?? null : row.lead;
    return { id: row.id, name: row.name, team_lead_id: row.team_lead_id, lead, members: byTeam.get(row.id) ?? [] };
  });
}

export async function getTeam(id: string): Promise<Team | null> {
  const teams = await listTeams();
  return teams.find((t) => t.id === id) ?? null;
}
