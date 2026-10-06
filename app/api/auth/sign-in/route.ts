import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    !body.email.trim() ||
    !body.password
  ) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email.trim(),
    password: body.password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 }
    );
  }

  return NextResponse.json({ signedIn: true });
}
