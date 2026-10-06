import { NextRequest, NextResponse } from "next/server";
import { Product } from "@/lib/products";
import {
  deleteProduct,
  nextProductId,
  readProducts,
  upsertProduct,
} from "@/lib/products-store";

export async function GET() {
  return NextResponse.json({ products: readProducts() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const products = readProducts();
  const product: Product = {
    product_id: body.product_id || nextProductId(products),
    name: body.name || "New Product",
    description: body.description || "",
    status: body.status || "Active",
    created_at: body.created_at || new Date().toISOString(),
    is_active: body.is_active === undefined ? "true" : String(body.is_active),
  };

  const updated = upsertProduct(product);
  return NextResponse.json({ product, products: updated });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const products = readProducts();
  const product = products.find((entry) => entry.product_id === body.product_id);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const updated: Product = {
    ...product,
    ...body,
    created_at: product.created_at,
  };
  const result = upsertProduct(updated);
  return NextResponse.json({ product: updated, products: result });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get("product_id");
  if (!productId) {
    return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
  }

  const products = deleteProduct(productId);
  if (products.length === 0) {
    return NextResponse.json({ products: [] });
  }

  return NextResponse.json({ products });
}
