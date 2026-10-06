import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { toLocalDateTimeIso } from "./format";
import {
  CONTACT_PRODUCT_STATUS_COLUMNS,
  DEFAULT_PRODUCTS,
  PRODUCT_COLUMNS,
  Product,
  ContactProductStatus,
} from "./products";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.csv");
const CONTACT_PRODUCT_STATUSES_PATH = path.join(DATA_DIR, "contact_product_statuses.csv");

function ensureFile(pathname: string, columns: readonly string[], defaults: Record<string, string>[] = []) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(pathname)) {
    const rows = defaults.length > 0 ? defaults : [];
    const csv = Papa.unparse(rows, { columns: [...columns], newline: "\n" });
    fs.writeFileSync(pathname, (csv ? csv + "\n" : columns.join(",") + "\n"), "utf-8");
  }
}

export function readProducts(): Product[] {
  ensureFile(PRODUCTS_PATH, PRODUCT_COLUMNS, DEFAULT_PRODUCTS.map((p) => ({ ...p })));
  const raw = fs.readFileSync(PRODUCTS_PATH, "utf-8");
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data
    .filter((row) => row.product_id)
    .map((row) => {
      const product: Record<string, string> = {};
      for (const col of PRODUCT_COLUMNS) {
        product[col] = (row[col] ?? "").toString().trim();
      }
      return product as Product;
    });
}

export function writeProducts(products: Product[]) {
  ensureFile(PRODUCTS_PATH, PRODUCT_COLUMNS, DEFAULT_PRODUCTS.map((p) => ({ ...p })));
  const csv = Papa.unparse(products, {
    columns: PRODUCT_COLUMNS as unknown as string[],
    newline: "\n",
  });
  fs.writeFileSync(PRODUCTS_PATH, csv + "\n", "utf-8");
}

export function readContactProductStatuses(): ContactProductStatus[] {
  ensureFile(CONTACT_PRODUCT_STATUSES_PATH, CONTACT_PRODUCT_STATUS_COLUMNS, []);
  const raw = fs.readFileSync(CONTACT_PRODUCT_STATUSES_PATH, "utf-8");
  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data
    .filter((row) => row.relationship_id)
    .map((row) => {
      const item: Record<string, string> = {};
      for (const col of CONTACT_PRODUCT_STATUS_COLUMNS) {
        item[col] = (row[col] ?? "").toString().trim();
      }
      return item as ContactProductStatus;
    });
}

export function writeContactProductStatuses(items: ContactProductStatus[]) {
  ensureFile(CONTACT_PRODUCT_STATUSES_PATH, CONTACT_PRODUCT_STATUS_COLUMNS, []);
  const csv = Papa.unparse(items, {
    columns: CONTACT_PRODUCT_STATUS_COLUMNS as unknown as string[],
    newline: "\n",
  });
  fs.writeFileSync(CONTACT_PRODUCT_STATUSES_PATH, csv + "\n", "utf-8");
}

export function nextProductId(products: Product[] = readProducts()): string {
  let max = 0;
  for (const product of products) {
    const match = /^P(\d+)$/.exec(product.product_id.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `P${String(max + 1).padStart(3, "0")}`;
}

export function upsertProduct(product: Product): Product[] {
  const products = readProducts();
  const index = products.findIndex((item) => item.product_id === product.product_id);
  if (index === -1) {
    products.push(product);
  } else {
    products[index] = product;
  }
  writeProducts(products);
  return products;
}

export function upsertContactProductStatus(item: ContactProductStatus): ContactProductStatus[] {
  const items = readContactProductStatuses();
  const index = items.findIndex(
    (entry) => entry.contact_id === item.contact_id && entry.product_id === item.product_id
  );
  const withTimestamp = {
    ...item,
    updated_at: toLocalDateTimeIso(),
    created_at: item.created_at || toLocalDateTimeIso(),
  };
  if (index === -1) {
    items.push(withTimestamp);
  } else {
    items[index] = withTimestamp;
  }
  writeContactProductStatuses(items);
  return items;
}

export function getStatusForContactAndProduct(
  contactId: string,
  productId: string
): ContactProductStatus | undefined {
  return readContactProductStatuses().find(
    (entry) => entry.contact_id === contactId && entry.product_id === productId
  );
}

export function getStatusesForContact(contactId: string): ContactProductStatus[] {
  return readContactProductStatuses().filter((entry) => entry.contact_id === contactId);
}

export function getStatusesForProduct(productId: string): ContactProductStatus[] {
  return readContactProductStatuses().filter((entry) => entry.product_id === productId);
}

export function deleteContactProductStatus(contactId: string, productId: string) {
  const items = readContactProductStatuses().filter(
    (entry) => !(entry.contact_id === contactId && entry.product_id === productId)
  );
  writeContactProductStatuses(items);
  return items;
}

export function deleteProduct(productId: string): Product[] {
  const products = readProducts().filter((product) => product.product_id !== productId);
  writeProducts(products);
  return products;
}
