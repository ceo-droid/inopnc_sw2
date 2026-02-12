import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseDate(raw: string): string | null {
  // "25년1월1일(수)" → "2025-01-01"
  const m = raw.match(/(\d+)년(\d+)월(\d+)일/);
  if (!m) return null;
  const year = 2000 + parseInt(m[1]);
  const month = String(parseInt(m[2])).padStart(2, "0");
  const day = String(parseInt(m[3])).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCSV(text: string): Record<string, string>[] {
  const rows: Record<string, string>[] = [];
  const lines = text.split("\n");
  // Remove BOM
  if (lines[0].charCodeAt(0) === 0xfeff) lines[0] = lines[0].slice(1);
  
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  let i = 1;
  while (i < lines.length) {
    let line = lines[i];
    // Handle multiline quoted fields
    while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += "\n" + lines[i];
    }
    i++;
    
    if (!line.trim()) continue;
    const values = parseCSVLine(line);
    if (values.length < headers.length) continue;
    
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j].trim()] = (values[j] || "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function countQuotes(s: string): number {
  let count = 0;
  for (const c of s) if (c === '"') count++;
  return count;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current);
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { csvUrl, csvText: directText } = await req.json();
    let csvText = directText;
    if (!csvText && csvUrl) {
      const resp = await fetch(csvUrl);
      csvText = await resp.text();
    }
    if (!csvText) {
      return new Response(JSON.stringify({ error: "csvText or csvUrl required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`CSV length: ${csvText.length}, first 200 chars: ${csvText.substring(0, 200)}`);
    const rows = parseCSV(csvText);
    console.log(`Parsed ${rows.length} rows`);
    if (rows.length > 0) {
      console.log("First row keys:", Object.keys(rows[0]).join(", "));
      console.log("First row:", JSON.stringify(rows[0]));
    }

    // Get sites
    const { data: sites } = await supabase.from("sites").select("id, name");
    const siteMap = new Map<string, string>();
    for (const s of sites || []) {
      siteMap.set(s.name.trim(), s.id);
    }

    // Get existing workers
    const { data: existingWorkers } = await supabase.from("workers").select("id, name, daily");
    const workerMap = new Map<string, string>();
    const workerDailyMap = new Map<string, number>();
    for (const w of existingWorkers || []) {
      workerMap.set(w.name, w.id);
      workerDailyMap.set(w.name, w.daily);
    }

    // Collect new workers from CSV
    const newWorkers = new Map<string, number>();
    for (const row of rows) {
      const name = row["작업자"];
      if (!name) continue;
      const daily = parseInt(row["기본값(단가)"]?.replace(/,/g, "") || "0") || 150000;
      if (!workerMap.has(name) && !newWorkers.has(name)) {
        newWorkers.set(name, daily);
      }
      // Update daily if higher value found
      if (!workerMap.has(name) && newWorkers.has(name)) {
        const existing = newWorkers.get(name)!;
        if (daily > existing) newWorkers.set(name, daily);
      }
    }

    // Insert new workers
    if (newWorkers.size > 0) {
      const workerRows = Array.from(newWorkers.entries()).map(([name, daily]) => ({ name, daily }));
      const { data: inserted, error: wErr } = await supabase.from("workers").insert(workerRows).select("id, name");
      if (wErr) throw wErr;
      for (const w of inserted || []) {
        workerMap.set(w.name, w.id);
      }
      console.log(`Inserted ${newWorkers.size} new workers`);
    }

    // Delete all existing work_logs
    const { error: delErr } = await supabase.from("work_logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) throw delErr;
    console.log("Deleted all work_logs");

    // Prepare work_logs
    const workLogs: any[] = [];
    const unmatchedSites = new Set<string>();
    
    for (const row of rows) {
      const dateRaw = row["일자"];
      const workerName = row["작업자"];
      const siteName = row["예산현장명"]?.trim();
      const md = parseFloat(row["공수"]?.replace(/,/g, "") || "1") || 1;
      const note = row["메모"] || "";

      if (!dateRaw || !workerName) continue;
      const date = parseDate(dateRaw);
      if (!date) continue;

      const workerId = workerMap.get(workerName);
      if (!workerId) continue;

      // Match site - try exact, then trimmed
      let siteId = "";
      if (siteName) {
        siteId = siteMap.get(siteName) || "";
        if (!siteId) {
          // Try fuzzy match
          for (const [name, id] of siteMap) {
            if (name.includes(siteName) || siteName.includes(name)) {
              siteId = id;
              break;
            }
          }
        }
        if (!siteId && siteName) {
          unmatchedSites.add(siteName);
        }
      }

      workLogs.push({ date, worker_id: workerId, site_id: siteId, md, note });
    }

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < workLogs.length; i += 500) {
      const batch = workLogs.slice(i, i + 500);
      const { error } = await supabase.from("work_logs").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalParsed: rows.length,
        inserted,
        newWorkers: newWorkers.size,
        unmatchedSites: Array.from(unmatchedSites),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
