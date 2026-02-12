import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all unmatched transactions
    const { data: unmatched, error: fetchErr } = await supabase
      .from("transactions")
      .select("id, date, description")
      .eq("site_id", "");
    
    if (fetchErr) throw fetchErr;
    if (!unmatched || unmatched.length === 0) {
      return new Response(JSON.stringify({ success: true, updated: 0, message: "No unmatched transactions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all workers
    const { data: workers } = await supabase.from("workers").select("id, name");
    const workerList = workers || [];

    // Get all work_logs
    const { data: workLogs } = await supabase.from("work_logs").select("date, worker_id, site_id");
    
    // Build lookup: date+worker_id -> site_id (pick most common if multiple)
    const dateSiteMap = new Map<string, string>();
    for (const wl of workLogs || []) {
      const key = `${wl.date}|${wl.worker_id}`;
      if (!dateSiteMap.has(key)) {
        dateSiteMap.set(key, wl.site_id);
      }
    }

    let updated = 0;
    const batchUpdates: Array<{ id: string; site_id: string }> = [];

    for (const tx of unmatched) {
      // Extract worker name from description like "merchant (workerName)"
      const match = tx.description?.match(/\(([^)]+)\)\s*$/);
      if (!match) continue;
      const workerName = match[1].trim();
      
      const worker = workerList.find(w => w.name === workerName);
      if (!worker) continue;

      const key = `${tx.date}|${worker.id}`;
      const siteId = dateSiteMap.get(key);
      if (siteId) {
        batchUpdates.push({ id: tx.id, site_id: siteId });
      }
    }

    // Execute updates in batches
    for (let i = 0; i < batchUpdates.length; i += 100) {
      const batch = batchUpdates.slice(i, i + 100);
      for (const item of batch) {
        const { error } = await supabase
          .from("transactions")
          .update({ site_id: item.site_id })
          .eq("id", item.id);
        if (!error) updated++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, totalUnmatched: unmatched.length, updated, remaining: unmatched.length - updated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
