import { NextResponse } from "next/server";

type DatabaseError = {
  code?: string;
  message?: string;
};

export function supabaseErrorResponse(
  operation: string,
  error: DatabaseError,
  duplicateMessage = "A lead with this phone number already exists."
): NextResponse {
  if (error.code === "23505") {
    return NextResponse.json(
      { error: duplicateMessage },
      { status: 409 }
    );
  }
  if (error.code === "P0001") {
    return NextResponse.json(
      { error: error.message || "The requested CRM action is invalid." },
      { status: 400 }
    );
  }
  if (error.code === "23503") {
    return NextResponse.json(
      { error: "A related lead or product no longer exists." },
      { status: 400 }
    );
  }

  console.error(`${operation} failed in Supabase`, {
    code: error.code || "unknown",
  });
  return NextResponse.json(
    { error: "The database request failed. Please try again." },
    { status: 500 }
  );
}
