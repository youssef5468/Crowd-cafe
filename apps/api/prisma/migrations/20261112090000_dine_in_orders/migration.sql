-- Dine-in orders: table number, short pickup code, payment time, and per-person lines for group orders.
ALTER TABLE "orders"
  ADD COLUMN "tableNumber" TEXT,
  ADD COLUMN "pickupCode" TEXT,
  ADD COLUMN "codeExpiresAt" TIMESTAMP(3),
  ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "orders_pickupCode_key" ON "orders"("pickupCode");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");

ALTER TABLE "order_items" ADD COLUMN "person" TEXT NOT NULL DEFAULT '';
