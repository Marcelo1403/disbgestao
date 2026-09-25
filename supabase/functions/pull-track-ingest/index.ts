import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-pull-track-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  if (req.method !== "POST") {
    return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  try {
    const url = new URL(req.url);
    const tripId = String(url.searchParams.get("trip_id") || "").trim();
    const token = String(req.headers.get("x-pull-track-token") || "").trim();

    if (!tripId || !token) {
      return json({ error: "TRACK_AUTH_REQUIRED" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "SERVER_CONFIG_MISSING" }, 500);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: tokenRow, error: tokenError } = await admin
      .from("pull_tracking_tokens")
      .select("trip_id,user_id,active")
      .eq("token", token)
      .eq("trip_id", tripId)
      .eq("active", true)
      .maybeSingle();

    if (tokenError) {
      console.error("tracking token", tokenError);
      return json({ error: "TRACK_TOKEN_LOOKUP_FAILED" }, 500);
    }

    if (!tokenRow) {
      return json({ error: "TRACK_TOKEN_INVALID" }, 401);
    }

    const { data: trip, error: tripError } = await admin
      .from("pull_trips")
      .select("id,status,driver1_id,driver2_id,active_driver_id,started_at,ended_at")
      .eq("id", tripId)
      .maybeSingle();

    if (tripError) {
      console.error("tracking trip", tripError);
      return json({ error: "TRACK_TRIP_LOOKUP_FAILED" }, 500);
    }

    if (!trip || trip.status !== "IN_PROGRESS") {
      return json({ error: "CICLO_NAO_ESTA_EM_ANDAMENTO" }, 410);
    }

    if (String(trip.active_driver_id || "") !== String(tokenRow.user_id || "")) {
      return json({ error: "MOTORISTA_NAO_ESTA_ATIVO" }, 409);
    }

    const body = await req.json();

    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const accuracy = body?.accuracy == null ? null : Number(body.accuracy);
    const speed = body?.speed == null ? null : Number(body.speed);
    const bearing = body?.bearing == null ? null : Number(body.bearing);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return json({ error: "COORDENADA_INVALIDA" }, 400);
    }

    if (accuracy != null && (!Number.isFinite(accuracy) || accuracy < 0)) {
      return json({ error: "PRECISAO_INVALIDA" }, 400);
    }

    // Guarda pontos utilizaveis. Fixes muito ruins sao ignorados para nao
    // deformar a linha do trajeto.
    if (accuracy != null && accuracy > 300) {
      return json({ ok: true, ignored: true, reason: "LOW_ACCURACY" }, 202);
    }

    let deviceAt = new Date().toISOString();

    const rawTime = body?.time ?? body?.timestamp;

    if (rawTime != null) {
      const n = Number(rawTime);

      if (Number.isFinite(n)) {
        const ms = n < 100000000000 ? n * 1000 : n;
        const d = new Date(ms);
        if (!Number.isNaN(d.getTime())) {
          deviceAt = d.toISOString();
        }
      } else {
        const d = new Date(String(rawTime));
        if (!Number.isNaN(d.getTime())) {
          deviceAt = d.toISOString();
        }
      }
    }

    const ingestKey = [
      tripId,
      String(tokenRow.user_id),
      deviceAt,
      latitude.toFixed(6),
      longitude.toFixed(6),
    ].join("|");

    const row = {
      trip_id: tripId,
      user_id: tokenRow.user_id,
      device_at: deviceAt,
      latitude,
      longitude,
      gps_accuracy: accuracy,
      ingest_key: ingestKey,
      source: "APK_NATIVE",
      speed_mps: Number.isFinite(speed) ? speed : null,
      bearing: Number.isFinite(bearing) ? bearing : null,
    };

    const { error: insertError } = await admin
      .from("pull_track_points")
      .insert(row);

    if (insertError) {
      if (String(insertError.code || "") === "23505") {
        return json({ ok: true, duplicate: true });
      }

      console.error("tracking insert", insertError);
      return json(
        {
          error: "TRACK_INSERT_FAILED",
          code: insertError.code || null,
          message: insertError.message || null,
        },
        500,
      );
    }

    return json({
      ok: true,
      trip_id: tripId,
      device_at: deviceAt,
    });
  } catch (e) {
    console.error("pull-track-ingest", e);

    return json(
      {
        error: "UNEXPECTED_ERROR",
        message: String((e as Error)?.message || e),
      },
      500,
    );
  }
});
