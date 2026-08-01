var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc4) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc4 = __getOwnPropDesc(from, key)) || desc4.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_config = require("dotenv/config");
var import_express12 = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_helmet = __toESM(require("helmet"), 1);
var import_multer2 = __toESM(require("multer"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_vite = require("vite");

// src/api/index.ts
var import_express11 = require("express");

// src/api/auth.ts
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);

// src/db/index.ts
var import_libsql = require("drizzle-orm/libsql");
var import_client = require("@libsql/client");

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  appointments: () => appointments,
  media: () => media,
  pages: () => pages,
  passwordResets: () => passwordResets,
  payments: () => payments,
  plans: () => plans,
  proSiteFiles: () => proSiteFiles,
  processedWebhookEvents: () => processedWebhookEvents,
  securityEvents: () => securityEvents,
  services: () => services,
  siteConfig: () => siteConfig,
  staff: () => staff,
  staffAvailability: () => staffAvailability,
  staffServices: () => staffServices,
  tenantBusinessHours: () => tenantBusinessHours,
  tenantClosures: () => tenantClosures,
  tenantSubscriptions: () => tenantSubscriptions,
  tenants: () => tenants,
  users: () => users
});
var import_sqlite_core = require("drizzle-orm/sqlite-core");
var tenants = (0, import_sqlite_core.sqliteTable)("tenants", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  // uuid
  name: (0, import_sqlite_core.text)("name").notNull(),
  slug: (0, import_sqlite_core.text)("slug").notNull().unique(),
  domain: (0, import_sqlite_core.text)("domain").unique(),
  // for custom domains
  category: (0, import_sqlite_core.text)("category"),
  // salon, clinic, pharmacy, spa, other
  isListed: (0, import_sqlite_core.integer)("is_listed", { mode: "boolean" }).default(true),
  isSuspended: (0, import_sqlite_core.integer)("is_suspended", { mode: "boolean" }).default(false),
  settings: (0, import_sqlite_core.text)("settings", { mode: "json" }),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var users = (0, import_sqlite_core.sqliteTable)("users", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id),
  // null if platform admin, but usually populated
  name: (0, import_sqlite_core.text)("name").notNull(),
  phone: (0, import_sqlite_core.text)("phone").notNull().unique(),
  // primary identity
  email: (0, import_sqlite_core.text)("email").notNull().unique(),
  // required for password reset links
  passwordHash: (0, import_sqlite_core.text)("password_hash").notNull(),
  role: (0, import_sqlite_core.text)("role").notNull(),
  // owner, staff, admin
  isSuperadmin: (0, import_sqlite_core.integer)("is_superadmin", { mode: "boolean" }).default(false),
  consentGivenAt: (0, import_sqlite_core.integer)("consent_given_at"),
  tokenVersion: (0, import_sqlite_core.integer)("token_version").default(0).notNull(),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var passwordResets = (0, import_sqlite_core.sqliteTable)("password_resets", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  token: (0, import_sqlite_core.text)("token").notNull(),
  userId: (0, import_sqlite_core.text)("user_id").references(() => users.id).notNull(),
  expiresAt: (0, import_sqlite_core.integer)("expires_at").notNull()
});
var plans = (0, import_sqlite_core.sqliteTable)("plans", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  name: (0, import_sqlite_core.text)("name").notNull(),
  price: (0, import_sqlite_core.integer)("price").notNull(),
  // in cents ETB
  maxStaff: (0, import_sqlite_core.integer)("max_staff").notNull(),
  customDomainAllowed: (0, import_sqlite_core.integer)("custom_domain_allowed", { mode: "boolean" }).default(false)
});
var tenantSubscriptions = (0, import_sqlite_core.sqliteTable)("tenant_subscriptions", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull().unique(),
  planId: (0, import_sqlite_core.text)("plan_id").references(() => plans.id),
  status: (0, import_sqlite_core.text)("status").notNull(),
  // trial, active, expired
  trialEndsAt: (0, import_sqlite_core.integer)("trial_ends_at"),
  startsAt: (0, import_sqlite_core.integer)("starts_at"),
  endsAt: (0, import_sqlite_core.integer)("ends_at")
});
var services = (0, import_sqlite_core.sqliteTable)("services", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  name: (0, import_sqlite_core.text)("name").notNull(),
  durationMinutes: (0, import_sqlite_core.integer)("duration_minutes").notNull(),
  price: (0, import_sqlite_core.integer)("price").notNull(),
  // ETB cents
  imagePath: (0, import_sqlite_core.text)("image_path"),
  active: (0, import_sqlite_core.integer)("active", { mode: "boolean" }).default(true)
});
var staff = (0, import_sqlite_core.sqliteTable)("staff", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  userId: (0, import_sqlite_core.text)("user_id").references(() => users.id),
  // optional linked login
  name: (0, import_sqlite_core.text)("name").notNull(),
  title: (0, import_sqlite_core.text)("title"),
  bio: (0, import_sqlite_core.text)("bio"),
  imagePath: (0, import_sqlite_core.text)("image_path"),
  active: (0, import_sqlite_core.integer)("active", { mode: "boolean" }).default(true)
});
var staffServices = (0, import_sqlite_core.sqliteTable)("staff_services", {
  staffId: (0, import_sqlite_core.text)("staff_id").references(() => staff.id).notNull(),
  serviceId: (0, import_sqlite_core.text)("service_id").references(() => services.id).notNull()
});
var staffAvailability = (0, import_sqlite_core.sqliteTable)("staff_availability", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  staffId: (0, import_sqlite_core.text)("staff_id").references(() => staff.id).notNull(),
  dayOfWeek: (0, import_sqlite_core.integer)("day_of_week").notNull(),
  // 0-6
  startTime: (0, import_sqlite_core.text)("start_time").notNull(),
  // "HH:MM"
  endTime: (0, import_sqlite_core.text)("end_time").notNull()
  // "HH:MM"
});
var tenantBusinessHours = (0, import_sqlite_core.sqliteTable)("tenant_business_hours", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  dayOfWeek: (0, import_sqlite_core.integer)("day_of_week").notNull(),
  openTime: (0, import_sqlite_core.text)("open_time"),
  closeTime: (0, import_sqlite_core.text)("close_time"),
  isClosed: (0, import_sqlite_core.integer)("is_closed", { mode: "boolean" }).default(false)
});
var tenantClosures = (0, import_sqlite_core.sqliteTable)("tenant_closures", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  date: (0, import_sqlite_core.text)("date").notNull(),
  // YYYY-MM-DD
  reason: (0, import_sqlite_core.text)("reason")
});
var appointments = (0, import_sqlite_core.sqliteTable)("appointments", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  customerName: (0, import_sqlite_core.text)("customer_name").notNull(),
  customerPhone: (0, import_sqlite_core.text)("customer_phone").notNull(),
  customerEmail: (0, import_sqlite_core.text)("customer_email"),
  staffId: (0, import_sqlite_core.text)("staff_id").references(() => staff.id).notNull(),
  serviceId: (0, import_sqlite_core.text)("service_id").references(() => services.id).notNull(),
  startTime: (0, import_sqlite_core.integer)("start_time").notNull(),
  // UTC timestamp ms
  endTime: (0, import_sqlite_core.integer)("end_time").notNull(),
  status: (0, import_sqlite_core.text)("status").notNull(),
  // pending, confirmed, cancelled, completed, no_show
  reminderSent: (0, import_sqlite_core.integer)("reminder_sent", { mode: "boolean" }).default(false)
});
var payments = (0, import_sqlite_core.sqliteTable)("payments", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  appointmentId: (0, import_sqlite_core.text)("appointment_id").references(() => appointments.id),
  amount: (0, import_sqlite_core.integer)("amount").notNull(),
  gateway: (0, import_sqlite_core.text)("gateway"),
  // tellbirr, chapa
  method: (0, import_sqlite_core.text)("method"),
  // telebirr, mpesa, ...
  gatewayReference: (0, import_sqlite_core.text)("gateway_reference"),
  // for chapa, this is the tx_ref
  status: (0, import_sqlite_core.text)("status").notNull(),
  // pending, success, failed, completed
  meta: (0, import_sqlite_core.text)("meta", { mode: "json" })
  // raw chapa verify/charge payloads for support
});
var pages = (0, import_sqlite_core.sqliteTable)("pages", {
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).primaryKey(),
  content: (0, import_sqlite_core.text)("content", { mode: "json" })
  // Puck document JSON
});
var proSiteFiles = (0, import_sqlite_core.sqliteTable)("pro_site_files", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  // uuid
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  // Path within the WebContainer project, e.g. "src/App.jsx" or "package.json".
  // Unique per tenant: a tenant only ever has one row per file path so PUTs
  // can upsert by (tenantId, file_path) without an id roundtrip.
  filePath: (0, import_sqlite_core.text)("file_path").notNull(),
  content: (0, import_sqlite_core.text)("content").notNull(),
  // raw file content (UTF-8)
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull()
}, (table) => [
  (0, import_sqlite_core.uniqueIndex)("pro_site_files_tenant_path_unique").on(table.tenantId, table.filePath)
]);
var media = (0, import_sqlite_core.sqliteTable)("media", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).notNull(),
  path: (0, import_sqlite_core.text)("path").notNull(),
  // public URL path e.g. /uploads/<tenantId>/<filename>
  originalName: (0, import_sqlite_core.text)("original_name").notNull(),
  mimeType: (0, import_sqlite_core.text)("mime_type").notNull(),
  size: (0, import_sqlite_core.integer)("size").notNull(),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var siteConfig = (0, import_sqlite_core.sqliteTable)("site_config", {
  tenantId: (0, import_sqlite_core.text)("tenant_id").references(() => tenants.id).primaryKey(),
  builderMode: (0, import_sqlite_core.text)("builder_mode").notNull().default("puck"),
  publishedCodeHtml: (0, import_sqlite_core.text)("published_code_html"),
  updatedAt: (0, import_sqlite_core.integer)("updated_at").notNull()
});
var securityEvents = (0, import_sqlite_core.sqliteTable)("security_events", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  eventType: (0, import_sqlite_core.text)("event_type").notNull(),
  tenantId: (0, import_sqlite_core.text)("tenant_id"),
  ip: (0, import_sqlite_core.text)("ip"),
  result: (0, import_sqlite_core.text)("result").notNull().default("failure"),
  details: (0, import_sqlite_core.text)("details", { mode: "json" }),
  createdAt: (0, import_sqlite_core.integer)("created_at").notNull()
});
var processedWebhookEvents = (0, import_sqlite_core.sqliteTable)("processed_webhook_events", {
  id: (0, import_sqlite_core.text)("id").primaryKey(),
  provider: (0, import_sqlite_core.text)("provider").notNull(),
  eventId: (0, import_sqlite_core.text)("event_id").notNull(),
  txRef: (0, import_sqlite_core.text)("tx_ref"),
  paymentId: (0, import_sqlite_core.text)("payment_id"),
  action: (0, import_sqlite_core.text)("action").notNull(),
  raw: (0, import_sqlite_core.text)("raw"),
  receivedAt: (0, import_sqlite_core.integer)("received_at").notNull()
}, (table) => [
  (0, import_sqlite_core.uniqueIndex)("processed_webhook_events_provider_event_unique").on(table.provider, table.eventId)
]);

// src/db/index.ts
var client = (0, import_client.createClient)({
  url: process.env.DATABASE_URL || "file:sqlite.db",
  // Give BEGIN IMMEDIATE up to 5s to wait for a holder of the write lock
  // (this is how two concurrent bookings serialize into one success + one
  // 409 — without busy_timeout, the second transaction would fail with
  // SQLITE_BUSY before getting a chance to re-read the row and detect the
  // conflict). See server/tests/booking-concurrency.test.ts for the proof.
  timeout: 5e3
});
var db = (0, import_libsql.drizzle)(client, { schema: schema_exports });

// src/api/auth.ts
var import_drizzle_orm2 = require("drizzle-orm");
var import_crypto2 = __toESM(require("crypto"), 1);

// server/lib/mailer.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);
var host = process.env.SMTP_HOST;
var port = parseInt(process.env.SMTP_PORT || "587");
var user = process.env.SMTP_USER;
var pass = process.env.SMTP_PASS;
var transporter = import_nodemailer.default.createTransport({
  host: host || "smtp.ethereal.email",
  port,
  auth: user ? {
    user,
    pass
  } : void 0
});
var FROM = process.env.SMTP_FROM || '"Egebeya" <noreply@egebeya.et>';
function redact(addr) {
  if (!addr) return "<none>";
  const at = addr.indexOf("@");
  const local = at === -1 ? addr : addr.slice(0, at);
  const domain = at === -1 ? "" : addr.slice(at);
  return `${local.slice(0, 3)}***${domain}`;
}
var sendMail = async (options) => {
  if (!host) {
    console.log("[MAILER STUB] Would send email to:", redact(String(options.to ?? "")));
    console.log("[MAILER STUB] Subject:", options.subject);
    return { messageId: "stub-message-id" };
  }
  try {
    const info = await transporter.sendMail({
      from: FROM,
      ...options
    });
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

// src/api/middleware/auth.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var import_drizzle_orm = require("drizzle-orm");
function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: JWT_SECRET is not set. Refusing to start in production.");
    }
    return "supersecret_fallback";
  }
  return s;
}
function refreshSecret() {
  const s = process.env.REFRESH_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: REFRESH_SECRET is not set. Refusing to start in production.");
    }
    return "refresh_supersecret_fallback";
  }
  return s;
}
function requireAuth(options = {}) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.slice(7);
    let payload;
    try {
      payload = import_jsonwebtoken.default.verify(token, jwtSecret());
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (!payload?.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user2 = await db.select().from(users).where((0, import_drizzle_orm.eq)(users.id, payload.userId)).get();
    if (!user2) {
      return res.status(401).json({ error: "User not found" });
    }
    const currentVersion = user2.tokenVersion ?? 0;
    if (typeof payload.tokenVersion !== "number" || payload.tokenVersion !== currentVersion) {
      return res.status(401).json({ error: "Session has been revoked, please sign in again" });
    }
    if (options.roles && options.roles.length > 0 && !options.roles.includes(payload.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.user = payload;
    next();
  };
}

// server/middleware/rateLimiter.ts
var import_express_rate_limit = __toESM(require("express-rate-limit"), 1);

// server/lib/securityLog.ts
var import_crypto = __toESM(require("crypto"), 1);
function logSecurityEvent(input) {
  const row = {
    id: import_crypto.default.randomUUID(),
    eventType: input.type,
    tenantId: input.tenantId ?? null,
    ip: input.ip ?? null,
    result: input.result ?? "failure",
    details: input.details ?? null,
    createdAt: Date.now()
  };
  try {
    if (row.details) {
      const json = JSON.stringify(row.details);
      row.details = json.length > 4096 ? json.slice(0, 4096) : json;
    }
    void db.insert(securityEvents).values(row).catch((err) => {
      console.error("[security-events] failed to persist:", err?.message || err);
    });
  } catch (err) {
    console.error("[security-events] threw synchronously:", err?.message || err);
  }
}
function ipFromRequest(req) {
  const ip = req?.ip ?? req?.socket?.remoteAddress ?? req?.connection?.remoteAddress;
  return typeof ip === "string" && ip.length > 0 ? ip : null;
}

// server/middleware/rateLimiter.ts
var isTestEnv = () => process.env.NODE_ENV === "test";
var authLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many auth attempts, please try again later.",
    code: "RATE_LIMITED_AUTH"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      ip: ipFromRequest(req),
      details: { surface: "auth", message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var otpLimiter = (0, import_express_rate_limit.default)({
  windowMs: 15 * 60 * 1e3,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many verification attempts, please try again later.",
    code: "RATE_LIMITED_OTP"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      ip: ipFromRequest(req),
      details: { surface: "otp", message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var bookingWriteLimiter = (0, import_express_rate_limit.default)({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many booking attempts from this address, please try again later.",
    code: "RATE_LIMITED_BOOKING"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      tenantId: req?.tenant?.id ?? null,
      ip: ipFromRequest(req),
      details: { surface: "booking", message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var publicReadLimiter = (0, import_express_rate_limit.default)({
  windowMs: 10 * 60 * 1e3,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many requests, please slow down.",
    code: "RATE_LIMITED_PUBLIC_READ"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      tenantId: req?.tenant?.id ?? null,
      ip: ipFromRequest(req),
      details: { surface: "public_read", path: req.path, message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var webhookLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many webhook deliveries from this address.",
    code: "RATE_LIMITED_WEBHOOK"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      ip: ipFromRequest(req),
      details: { surface: "webhook", message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var tenantWriteLimiter = (0, import_express_rate_limit.default)({
  windowMs: 10 * 60 * 1e3,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestEnv() || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  message: {
    error: "Too many write requests, please slow down.",
    code: "RATE_LIMITED_TENANT_WRITE"
  },
  keyGenerator: (req) => {
    const tenantId = req?.user?.tenantId ?? "anon";
    return `${ipFromRequest(req) ?? "unknown"}:${tenantId}`;
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      tenantId: req?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: "tenant_write", path: req.path, method: req.method, message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var uploadLimiter = (0, import_express_rate_limit.default)({
  windowMs: 10 * 60 * 1e3,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  message: {
    error: "Too many uploads, please try again later.",
    code: "RATE_LIMITED_UPLOAD"
  },
  keyGenerator: (req) => {
    const tenantId = req?.user?.tenantId ?? "anon";
    return `upload:${ipFromRequest(req) ?? "unknown"}:${tenantId}`;
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      tenantId: req?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: "upload", message: options.message }
    });
    res.status(429).json(options.message);
  }
});
var adminWriteLimiter = (0, import_express_rate_limit.default)({
  windowMs: 60 * 1e3,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isTestEnv() || req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
  message: {
    error: "Too many admin actions, please slow down.",
    code: "RATE_LIMITED_ADMIN"
  },
  handler: (req, res, _next, options) => {
    logSecurityEvent({
      type: "rate_limit",
      tenantId: req?.user?.tenantId ?? null,
      ip: ipFromRequest(req),
      details: { surface: "admin", path: req.path, method: req.method, message: options.message }
    });
    res.status(429).json(options.message);
  }
});

// src/lib/phone.ts
var ETHIOPIAN_PHONE_RE = /^(?:(?:\+?251)|(?:0)?)(\d{9})$/;
function normalizePhone(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().replace(/[\s-]/g, "");
  const m = s.match(ETHIOPIAN_PHONE_RE);
  if (!m) return null;
  return `+251${m[1]}`;
}

// src/api/auth.ts
var router = (0, import_express.Router)();
var RESERVED_SLUGS = ["www", "api", "admin", "app", "mail", "ftp", "static", "cdn", "blog", "support", "help", "dashboard"];
router.use(authLimiter);
router.post("/check-slug", async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: "Slug is required" });
    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.json({ available: false, error: "This business URL is reserved" });
    }
    const existingTenant = await db.select().from(tenants).where((0, import_drizzle_orm2.eq)(tenants.slug, normalizedSlug)).get();
    res.json({ available: !existingTenant });
  } catch (error) {
    res.status(500).json({ error: "Failed to check slug" });
  }
});
async function getOrCreateFreePlan() {
  const existing = await db.select().from(plans).where((0, import_drizzle_orm2.eq)(plans.name, "free")).get();
  if (existing) return existing;
  const row = { id: import_crypto2.default.randomUUID(), name: "free", price: 0, maxStaff: 2, customDomainAllowed: false };
  await db.insert(plans).values(row);
  return row;
}
router.post("/register", async (req, res) => {
  try {
    const { name, phone, password, businessName, slug, email, city, consent } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      return res.status(400).json({ error: "A valid email is required" });
    }
    if (!consent || consent !== true) {
      return res.status(400).json({ error: "You must agree to the Privacy Policy and Terms of Service to register." });
    }
    const consentGivenAt = Date.now();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        error: "Enter a valid Ethiopian phone number (+251XXXXXXXXX)"
      });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const existingEmail = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.email, normalizedEmail)).get();
    if (existingEmail) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const existingUser = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(400).json({ error: "Phone number already registered" });
    }
    const normalizedSlug = slug.toLowerCase().trim();
    if (RESERVED_SLUGS.includes(normalizedSlug)) {
      return res.status(400).json({ error: "This business URL is reserved" });
    }
    const existingTenant = await db.select().from(tenants).where((0, import_drizzle_orm2.eq)(tenants.slug, normalizedSlug)).get();
    if (existingTenant) {
      return res.status(400).json({ error: "Business URL already taken" });
    }
    const tenantId = import_crypto2.default.randomUUID();
    const userId = import_crypto2.default.randomUUID();
    const passwordHash = await import_bcryptjs.default.hash(password, 10);
    const trimmedCity = typeof city === "string" && city.trim() ? city.trim() : null;
    const initialSettings = trimmedCity ? { city: trimmedCity } : {};
    await db.transaction(async (tx) => {
      await tx.insert(tenants).values({
        id: tenantId,
        name: businessName,
        slug: normalizedSlug,
        settings: initialSettings,
        createdAt: Date.now()
      });
      await tx.insert(users).values({
        id: userId,
        tenantId,
        name,
        phone: normalizedPhone,
        email: normalizedEmail,
        passwordHash,
        role: "owner",
        consentGivenAt,
        createdAt: Date.now()
      });
      const plan = await getOrCreateFreePlan();
      await tx.insert(tenantSubscriptions).values({
        id: import_crypto2.default.randomUUID(),
        tenantId,
        planId: plan.id,
        status: "trial",
        trialEndsAt: Date.now() + 14 * 24 * 3600 * 1e3,
        startsAt: Date.now()
      });
    });
    const userRecord = await db.select({ tokenVersion: users.tokenVersion }).from(users).where((0, import_drizzle_orm2.eq)(users.id, userId)).get();
    const tokenVersion = userRecord?.tokenVersion ?? 0;
    const token = import_jsonwebtoken2.default.sign({ userId, tenantId, role: "owner", tokenVersion }, jwtSecret(), { expiresIn: "15m" });
    const refreshToken = import_jsonwebtoken2.default.sign({ userId, tenantId, tokenVersion }, refreshSecret(), { expiresIn: "7d" });
    res.json({
      token,
      refreshToken,
      role: "owner",
      tenantId,
      tenant: { id: tenantId, name: businessName, slug: normalizedSlug }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Failed to register" });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({
        error: "Enter a valid Ethiopian phone number (+251XXXXXXXXX)"
      });
    }
    const user2 = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.phone, normalizedPhone)).get();
    if (!user2) {
      logSecurityEvent({
        type: "failed_login",
        ip: ipFromRequest(req),
        details: { reason: "no_user", phone: normalizedPhone }
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const isValid = await import_bcryptjs.default.compare(password, user2.passwordHash);
    if (!isValid) {
      logSecurityEvent({
        type: "failed_login",
        tenantId: user2.tenantId ?? void 0,
        ip: ipFromRequest(req),
        details: { reason: "bad_password", phone: normalizedPhone }
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const tenant = user2.tenantId ? await db.select().from(tenants).where((0, import_drizzle_orm2.eq)(tenants.id, user2.tenantId)).get() : null;
    const tokenVersion = user2.tokenVersion ?? 0;
    const isSuperadmin = !!user2.isSuperadmin;
    const token = import_jsonwebtoken2.default.sign({ userId: user2.id, tenantId: user2.tenantId, role: user2.role, tokenVersion }, jwtSecret(), { expiresIn: "15m" });
    const refreshToken = import_jsonwebtoken2.default.sign({ userId: user2.id, tenantId: user2.tenantId, tokenVersion }, refreshSecret(), { expiresIn: "7d" });
    res.json({
      token,
      refreshToken,
      role: user2.role,
      isSuperadmin,
      tenantId: user2.tenantId,
      tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to login" });
  }
});
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: "Refresh token required" });
    import_jsonwebtoken2.default.verify(refreshToken, refreshSecret(), async (err, payload) => {
      if (err) return res.status(403).json({ error: "Invalid or expired refresh token" });
      const user2 = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.id, payload.userId)).get();
      if (!user2) return res.status(404).json({ error: "User not found" });
      if (typeof payload.tokenVersion !== "number" || payload.tokenVersion !== user2.tokenVersion) {
        return res.status(403).json({ error: "Refresh token has been revoked" });
      }
      const tokenVersion = user2.tokenVersion ?? 0;
      const newToken = import_jsonwebtoken2.default.sign({ userId: user2.id, tenantId: user2.tenantId, role: user2.role, tokenVersion }, jwtSecret(), { expiresIn: "15m" });
      res.json({ token: newToken });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    const user2 = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.email, email)).get();
    if (!user2) {
      return res.json({ success: true, message: "If that email is registered, you will receive a reset link." });
    }
    await db.delete(passwordResets).where((0, import_drizzle_orm2.eq)(passwordResets.userId, user2.id));
    const token = import_crypto2.default.randomUUID();
    await db.insert(passwordResets).values({
      id: import_crypto2.default.randomUUID(),
      token,
      userId: user2.id,
      expiresAt: Date.now() + 15 * 60 * 1e3
      // 15 mins
    });
    const resetLink = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    await sendMail({
      to: email,
      subject: "Password Reset Request",
      text: `Hello,

You requested to reset your password. Click the link below to reset it:
${resetLink}

This link expires in 15 minutes.
If you did not request this, please ignore this email.`
    });
    res.json({ success: true, message: "If that email is registered, you will receive a reset link." });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
});
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
    const resetRecord = await db.select().from(passwordResets).where((0, import_drizzle_orm2.eq)(passwordResets.token, token)).get();
    if (!resetRecord) return res.status(400).json({ error: "Invalid or expired token" });
    if (Date.now() > resetRecord.expiresAt) {
      await db.delete(passwordResets).where((0, import_drizzle_orm2.eq)(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: "Token has expired" });
    }
    const user2 = await db.select().from(users).where((0, import_drizzle_orm2.eq)(users.id, resetRecord.userId)).get();
    if (!user2) {
      await db.delete(passwordResets).where((0, import_drizzle_orm2.eq)(passwordResets.id, resetRecord.id));
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    const passwordHash = await import_bcryptjs.default.hash(newPassword, 10);
    await db.update(users).set({
      passwordHash,
      tokenVersion: (user2.tokenVersion ?? 0) + 1
    }).where((0, import_drizzle_orm2.eq)(users.id, resetRecord.userId));
    await db.delete(passwordResets).where((0, import_drizzle_orm2.eq)(passwordResets.userId, resetRecord.userId));
    res.json({ success: true, message: "Password has been updated" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const token = authHeader.slice(7);
    import_jsonwebtoken2.default.verify(token, jwtSecret(), async (err, payload) => {
      if (err) return res.status(401).json({ error: "Invalid token" });
      await db.update(users).set({ tokenVersion: import_drizzle_orm2.sql`token_version + 1` }).where((0, import_drizzle_orm2.eq)(users.id, payload.userId));
      res.json({ success: true });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
});
var auth_default = router;

// src/api/tenant.ts
var import_express2 = require("express");
var import_bcryptjs2 = __toESM(require("bcryptjs"), 1);
var import_drizzle_orm4 = require("drizzle-orm");
var import_crypto3 = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_sharp = __toESM(require("sharp"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);

// server/middleware/planLimits.ts
var import_drizzle_orm3 = require("drizzle-orm");
function requirePlanLimit(resource) {
  return async (req, res, next) => {
    const { tenantId } = req.user;
    if (!tenantId) {
      return res.status(401).json({ error: "Unauthorized \u2014 no tenant context" });
    }
    let subscription;
    let plan;
    try {
      subscription = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm3.eq)(tenantSubscriptions.tenantId, tenantId)).get();
      if (!subscription) {
        return res.status(403).json({ error: "No active subscription. Complete setup first." });
      }
      plan = subscription.planId ? await db.select().from(plans).where((0, import_drizzle_orm3.eq)(plans.id, subscription.planId)).get() : null;
      if (!plan) {
        return res.status(403).json({ error: "Subscription plan not found." });
      }
      if (resource === "staff") {
        const currentStaff = await db.select().from(staff).where((0, import_drizzle_orm3.eq)(staff.tenantId, tenantId)).all();
        if (currentStaff.length >= plan.maxStaff) {
          return res.status(403).json({
            error: `Staff limit reached for your plan (max ${plan.maxStaff}). Upgrade to add more staff.`
          });
        }
      }
      req.plan = plan;
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error("planLimits middleware error:", error);
      res.status(500).json({ error: "Failed to check plan limits" });
    }
  };
}
async function requireActiveSubscription(req, res, next) {
  const { tenantId } = req.user;
  if (!tenantId) {
    return res.status(401).json({ error: "Unauthorized \u2014 no tenant context" });
  }
  try {
    const subscription = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm3.eq)(tenantSubscriptions.tenantId, tenantId)).get();
    if (!subscription) {
      return res.status(403).json({ error: "No active subscription. Complete setup first." });
    }
    const plan = subscription.planId ? await db.select().from(plans).where((0, import_drizzle_orm3.eq)(plans.id, subscription.planId)).get() : null;
    if (!plan) {
      return res.status(403).json({ error: "Subscription plan not found." });
    }
    req.plan = plan;
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("requireActiveSubscription error:", error);
    res.status(500).json({ error: "Failed to load subscription" });
  }
}

// src/api/tenant.ts
var router2 = (0, import_express2.Router)();
var uploadDir = import_path.default.join(process.cwd(), "dist", "uploads");
if (!import_fs.default.existsSync(uploadDir)) {
  import_fs.default.mkdirSync(uploadDir, { recursive: true });
}
var tenantDir = (tenantId) => {
  const dir = import_path.default.join(uploadDir, tenantId);
  if (!import_fs.default.existsSync(dir)) import_fs.default.mkdirSync(dir, { recursive: true });
  return dir;
};
var storage = import_multer.default.memoryStorage();
var upload = (0, import_multer.default)({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  // 8MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only images are allowed"));
  }
});
router2.use(requireAuth({ roles: ["owner"] }));
router2.use(tenantWriteLimiter);
router2.post("/staff", requirePlanLimit("staff"), async (req, res) => {
  const { tenantId } = req.user;
  const { name, title, bio, imagePath, userId } = req.body;
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: "Staff name is required" });
  }
  const staffId = import_crypto3.default.randomUUID();
  await db.insert(staff).values({
    id: staffId,
    tenantId,
    userId: userId ?? null,
    name: String(name).trim(),
    title: title ?? null,
    bio: bio ?? null,
    imagePath: imagePath ?? null,
    active: true
  });
  const created = await db.select().from(staff).where((0, import_drizzle_orm4.eq)(staff.id, staffId)).get();
  res.status(201).json(created);
});
router2.post("/staff/invite", requirePlanLimit("staff"), async (req, res) => {
  const { tenantId } = req.user;
  const { name, phone, email, staff_id } = req.body || {};
  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: "Staff name is required" });
  }
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ error: "Enter a valid Ethiopian phone number (+251XXXXXXXXX)" });
  }
  try {
    const existingUser = await db.select().from(users).where((0, import_drizzle_orm4.eq)(users.phone, normalizedPhone)).get();
    if (existingUser) {
      return res.status(409).json({ error: "A user with this phone number already exists" });
    }
    let staffRow = null;
    if (staff_id) {
      staffRow = await db.select().from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, staff_id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
      if (!staffRow) return res.status(404).json({ error: "Staff not found for this tenant" });
    }
    const tempPassword = import_crypto3.default.randomBytes(18).toString("base64url");
    const passwordHash = await import_bcryptjs2.default.hash(tempPassword, 10);
    const userId = import_crypto3.default.randomUUID();
    await db.insert(users).values({
      id: userId,
      tenantId,
      name: String(name).trim(),
      phone: normalizedPhone,
      email: email ? String(email).trim().toLowerCase() : null,
      passwordHash,
      role: "staff",
      createdAt: Date.now()
    });
    if (staffRow) {
      await db.update(staff).set({ userId }).where((0, import_drizzle_orm4.eq)(staff.id, staffRow.id));
    } else {
      const newStaffId = import_crypto3.default.randomUUID();
      await db.insert(staff).values({
        id: newStaffId,
        tenantId,
        userId,
        name: String(name).trim(),
        title: null,
        bio: null,
        imagePath: null,
        active: true
      });
    }
    const resetToken = import_crypto3.default.randomUUID();
    await db.insert(passwordResets).values({
      id: import_crypto3.default.randomUUID(),
      token: resetToken,
      userId,
      expiresAt: Date.now() + 15 * 60 * 1e3
    });
    const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;
    res.status(201).json({
      success: true,
      userId,
      staffId: staffRow?.id ?? null,
      resetUrl
    });
  } catch (error) {
    console.error("Invite staff error:", error);
    res.status(500).json({ error: "Failed to invite staff" });
  }
});
router2.put("/staff/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { name, title, bio, imagePath, active } = req.body;
  if (name !== void 0 && !String(name).trim()) {
    return res.status(400).json({ error: "name cannot be empty" });
  }
  try {
    const owned = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: "Staff not found for this tenant" });
    const updates = {};
    if (name !== void 0) updates.name = String(name).trim();
    if (title !== void 0) updates.title = title ?? null;
    if (bio !== void 0) updates.bio = bio ?? null;
    if (imagePath !== void 0) updates.imagePath = imagePath ?? null;
    if (active !== void 0) updates.active = !!active;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }
    await db.update(staff).set(updates).where((0, import_drizzle_orm4.eq)(staff.id, id));
    const updated = await db.select().from(staff).where((0, import_drizzle_orm4.eq)(staff.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error("Update staff error:", error);
    res.status(500).json({ error: "Failed to update staff" });
  }
});
router2.delete("/staff/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: "Staff not found for this tenant" });
    await db.delete(staffServices).where((0, import_drizzle_orm4.eq)(staffServices.staffId, id));
    await db.delete(staffAvailability).where((0, import_drizzle_orm4.eq)(staffAvailability.staffId, id));
    await db.delete(staff).where((0, import_drizzle_orm4.eq)(staff.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error("Delete staff error:", error);
    res.status(500).json({ error: "Failed to delete staff" });
  }
});
router2.get("/staff/:id/services", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: "Staff not found for this tenant" });
    const links = await db.select().from(staffServices).where((0, import_drizzle_orm4.eq)(staffServices.staffId, id)).all();
    const serviceIds = links.map((l) => l.serviceId);
    const rows = serviceIds.length ? await db.select().from(services).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(services.tenantId, tenantId), (0, import_drizzle_orm4.inArray)(services.id, serviceIds))).all() : [];
    res.json(rows.map((s) => ({ id: s.id, name: s.name })));
  } catch (error) {
    console.error("Fetch staff services error:", error);
    res.status(500).json({ error: "Failed to fetch staff services" });
  }
});
router2.get("/staff/:id/availability", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const owned = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: "Staff not found for this tenant" });
    const rows = await db.select().from(staffAvailability).where((0, import_drizzle_orm4.eq)(staffAvailability.staffId, id)).all();
    res.json(rows.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime
    })));
  } catch (error) {
    console.error("Fetch staff availability error:", error);
    res.status(500).json({ error: "Failed to fetch staff availability" });
  }
});
router2.put("/business-hours", async (req, res) => {
  const { tenantId } = req.user;
  const { hours } = req.body;
  if (!Array.isArray(hours) || hours.length === 0) {
    return res.status(400).json({ error: "hours must be a non-empty array" });
  }
  try {
    await db.delete(tenantBusinessHours).where((0, import_drizzle_orm4.eq)(tenantBusinessHours.tenantId, tenantId));
    await db.insert(tenantBusinessHours).values(
      hours.map((h) => ({
        id: import_crypto3.default.randomUUID(),
        tenantId,
        dayOfWeek: h.dayOfWeek,
        openTime: h.isClosed ? null : h.openTime ?? null,
        closeTime: h.isClosed ? null : h.closeTime ?? null,
        isClosed: h.isClosed
      }))
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Business hours error:", error);
    res.status(500).json({ error: "Failed to save business hours" });
  }
});
router2.post("/staff/:id/services", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { service_ids } = req.body;
  if (!Array.isArray(service_ids)) {
    return res.status(400).json({ error: "service_ids must be an array" });
  }
  try {
    const staffRow = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!staffRow) return res.status(404).json({ error: "Staff not found for this tenant" });
    const owned = service_ids.length ? await db.select({ id: services.id }).from(services).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(services.tenantId, tenantId), (0, import_drizzle_orm4.inArray)(services.id, service_ids))).all() : [];
    const ownedIds = new Set(owned.map((s) => s.id));
    const validIds = service_ids.filter((sid) => ownedIds.has(sid));
    await db.delete(staffServices).where((0, import_drizzle_orm4.eq)(staffServices.staffId, id));
    if (validIds.length > 0) {
      await db.insert(staffServices).values(validIds.map((serviceId) => ({ staffId: id, serviceId })));
    }
    res.json({ success: true, assigned: validIds });
  } catch (error) {
    console.error("Assign services error:", error);
    res.status(500).json({ error: "Failed to assign services" });
  }
});
router2.put("/staff/:id/availability", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { availability } = req.body;
  if (!Array.isArray(availability)) {
    return res.status(400).json({ error: "availability must be an array" });
  }
  try {
    const owned = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(staff.id, id), (0, import_drizzle_orm4.eq)(staff.tenantId, tenantId))).get();
    if (!owned) return res.status(404).json({ error: "Staff not found for this tenant" });
    await db.delete(staffAvailability).where((0, import_drizzle_orm4.eq)(staffAvailability.staffId, id));
    if (availability.length > 0) {
      await db.insert(staffAvailability).values(
        availability.map((a) => ({
          id: import_crypto3.default.randomUUID(),
          staffId: id,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime
        }))
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Staff availability error:", error);
    res.status(500).json({ error: "Failed to set availability" });
  }
});
router2.put("/domain", requireActiveSubscription, async (req, res) => {
  const plan = req.plan;
  if (!plan.customDomainAllowed) {
    return res.status(403).json({ error: "Custom domains require the Pro plan" });
  }
  res.json({ success: true });
});
router2.get("/subscription", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const subscription = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm4.eq)(tenantSubscriptions.tenantId, tenantId)).get();
    if (!subscription) return res.status(404).json({ error: "Subscription not found" });
    const plan = await db.select().from(plans).where((0, import_drizzle_orm4.eq)(plans.id, subscription.planId)).get();
    const staffList = await db.select().from(staff).where((0, import_drizzle_orm4.eq)(staff.tenantId, tenantId)).all();
    res.json({
      subscription,
      plan,
      staffUsage: staffList.length
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});
router2.get("/settings", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const tenant = await db.select().from(tenants).where((0, import_drizzle_orm4.eq)(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    res.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ...tenant.settings || {}
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});
router2.put("/settings", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const tenant = await db.select().from(tenants).where((0, import_drizzle_orm4.eq)(tenants.id, tenantId)).get();
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });
    const { name, slug: _ignoredSlug, ...rest } = req.body || {};
    const trimmedName = typeof name === "string" && name.trim().length > 0 ? name.trim() : void 0;
    const newSettings = { ...tenant.settings || {}, ...rest };
    const updates = { settings: newSettings };
    if (trimmedName !== void 0) updates.name = trimmedName;
    await db.update(tenants).set(updates).where((0, import_drizzle_orm4.eq)(tenants.id, tenantId));
    res.json({
      success: true,
      settings: {
        id: tenant.id,
        name: trimmedName ?? tenant.name,
        slug: tenant.slug,
        ...newSettings
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});
router2.get("/page", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const page = await db.select().from(pages).where((0, import_drizzle_orm4.eq)(pages.tenantId, tenantId)).get();
    res.json(page || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch page" });
  }
});
router2.put("/page", async (req, res) => {
  const { tenantId } = req.user;
  const { content } = req.body;
  try {
    const existing = await db.select().from(pages).where((0, import_drizzle_orm4.eq)(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content }).where((0, import_drizzle_orm4.eq)(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({
        tenantId,
        content
      });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update page" });
  }
});
router2.post("/page", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const tenant = await db.select().from(tenants).where((0, import_drizzle_orm4.eq)(tenants.id, tenantId)).get();
    const tenantServices = await db.select().from(services).where((0, import_drizzle_orm4.eq)(services.tenantId, tenantId)).all();
    const staffList = await db.select().from(staff).where((0, import_drizzle_orm4.eq)(staff.tenantId, tenantId)).all();
    const defaultContent = {
      content: [
        {
          type: "Hero",
          props: {
            title: tenant?.name || "Welcome",
            subtitle: "Book your next appointment online \u2014 fast and simple."
          },
          data: {}
        },
        { type: "About", props: { content: `Book an appointment with ${tenant?.name || "us"} online.` }, data: {} },
        { type: "Services", props: {}, data: {} },
        { type: "BookingForm", props: {}, data: {} },
        { type: "Contact", props: {}, data: {} }
      ],
      root: {}
    };
    void tenantServices;
    void staffList;
    const existing = await db.select().from(pages).where((0, import_drizzle_orm4.eq)(pages.tenantId, tenantId)).get();
    if (existing) {
      await db.update(pages).set({ content: defaultContent }).where((0, import_drizzle_orm4.eq)(pages.tenantId, tenantId));
    } else {
      await db.insert(pages).values({ tenantId, content: defaultContent });
    }
    res.status(201).json({ success: true, content: defaultContent });
  } catch (error) {
    console.error("Default page error:", error);
    res.status(500).json({ error: "Failed to generate default page" });
  }
});
router2.post("/upload", uploadLimiter, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const { tenantId } = req.user;
  if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const dir = tenantDir(tenantId);
    const filename = `${import_crypto3.default.randomUUID()}.jpg`;
    const filepath = import_path.default.join(dir, filename);
    await (0, import_sharp.default)(req.file.buffer).resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(filepath);
    const publicPath = `/uploads/${tenantId}/${filename}`;
    const id = import_crypto3.default.randomUUID();
    await db.insert(media).values({
      id,
      tenantId,
      path: publicPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      createdAt: Date.now()
    });
    res.json({
      id,
      path: publicPath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
});
router2.get("/media", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const list = await db.select().from(media).where((0, import_drizzle_orm4.eq)(media.tenantId, tenantId)).orderBy((0, import_drizzle_orm4.desc)(media.createdAt)).all();
    res.json(list);
  } catch (error) {
    console.error("List media error:", error);
    res.status(500).json({ error: "Failed to fetch media" });
  }
});
router2.delete("/media/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const row = await db.select().from(media).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(media.id, id), (0, import_drizzle_orm4.eq)(media.tenantId, tenantId))).get();
    if (!row) return res.status(404).json({ error: "Media not found for this tenant" });
    try {
      const relative = row.path.replace(/^\/uploads\//, "");
      const safeRelative = import_path.default.normalize(relative);
      if (!safeRelative.startsWith("..")) {
        const absolute = import_path.default.join(uploadDir, safeRelative);
        if (import_fs.default.existsSync(absolute)) import_fs.default.unlinkSync(absolute);
      }
    } catch (fsErr) {
      console.warn("Failed to unlink media file:", fsErr);
    }
    await db.delete(media).where((0, import_drizzle_orm4.eq)(media.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error("Delete media error:", error);
    res.status(500).json({ error: "Failed to delete media" });
  }
});
router2.get("/staff", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const list = await db.select().from(staff).where((0, import_drizzle_orm4.eq)(staff.tenantId, tenantId)).all();
    const allLinks = list.length ? await db.select().from(staffServices).where((0, import_drizzle_orm4.inArray)(staffServices.staffId, list.map((s) => s.id))).all() : [];
    const svcIds = Array.from(new Set(allLinks.map((l) => l.serviceId)));
    const svcRows = svcIds.length ? await db.select().from(services).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(services.tenantId, tenantId), (0, import_drizzle_orm4.inArray)(services.id, svcIds))).all() : [];
    const svcById = new Map(svcRows.map((s) => [s.id, s]));
    const linksByStaff = /* @__PURE__ */ new Map();
    for (const l of allLinks) {
      const svc = svcById.get(l.serviceId);
      if (!svc) continue;
      const arr = linksByStaff.get(l.staffId) || [];
      arr.push({ id: svc.id, name: svc.name });
      linksByStaff.set(l.staffId, arr);
    }
    const withServices = list.map((s) => ({
      ...s,
      services: linksByStaff.get(s.id) || []
    }));
    res.json(withServices);
  } catch (error) {
    console.error("Fetch staff error:", error);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});
router2.get("/services", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const list = await db.select().from(services).where((0, import_drizzle_orm4.eq)(services.tenantId, tenantId)).all();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
});
router2.post("/services", async (req, res) => {
  const { tenantId } = req.user;
  const { name, durationMinutes, price, imagePath } = req.body;
  if (!name || !durationMinutes || price === void 0 || price === null) {
    return res.status(400).json({ error: "name, durationMinutes and price are required" });
  }
  if (typeof durationMinutes !== "number" || durationMinutes <= 0) {
    return res.status(400).json({ error: "durationMinutes must be a positive number" });
  }
  if (typeof price !== "number" || price < 0) {
    return res.status(400).json({ error: "price must be a non-negative number (ETB cents)" });
  }
  try {
    const id = import_crypto3.default.randomUUID();
    await db.insert(services).values({
      id,
      tenantId,
      name: String(name).trim(),
      durationMinutes,
      price,
      imagePath: imagePath ?? null,
      active: true
    });
    const created = await db.select().from(services).where((0, import_drizzle_orm4.eq)(services.id, id)).get();
    res.status(201).json(created);
  } catch (error) {
    console.error("Create service error:", error);
    res.status(500).json({ error: "Failed to create service" });
  }
});
router2.put("/services/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { name, durationMinutes, price, imagePath, active } = req.body;
  if (name !== void 0 && !String(name).trim()) {
    return res.status(400).json({ error: "name cannot be empty" });
  }
  if (durationMinutes !== void 0 && (typeof durationMinutes !== "number" || durationMinutes <= 0)) {
    return res.status(400).json({ error: "durationMinutes must be a positive number" });
  }
  if (price !== void 0 && (typeof price !== "number" || price < 0)) {
    return res.status(400).json({ error: "price must be a non-negative number (ETB cents)" });
  }
  try {
    const existing = await db.select().from(services).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(services.id, id), (0, import_drizzle_orm4.eq)(services.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: "Service not found for this tenant" });
    }
    const updates = {};
    if (name !== void 0) updates.name = String(name).trim();
    if (durationMinutes !== void 0) updates.durationMinutes = durationMinutes;
    if (price !== void 0) updates.price = price;
    if (imagePath !== void 0) updates.imagePath = imagePath;
    if (active !== void 0) updates.active = !!active;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }
    await db.update(services).set(updates).where((0, import_drizzle_orm4.eq)(services.id, id));
    const updated = await db.select().from(services).where((0, import_drizzle_orm4.eq)(services.id, id)).get();
    res.json(updated);
  } catch (error) {
    console.error("Update service error:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
});
router2.delete("/services/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const existing = await db.select().from(services).where((0, import_drizzle_orm4.and)((0, import_drizzle_orm4.eq)(services.id, id), (0, import_drizzle_orm4.eq)(services.tenantId, tenantId))).get();
    if (!existing) {
      return res.status(404).json({ error: "Service not found for this tenant" });
    }
    await db.delete(staffServices).where((0, import_drizzle_orm4.eq)(staffServices.serviceId, id));
    await db.delete(services).where((0, import_drizzle_orm4.eq)(services.id, id));
    res.json({ success: true, id });
  } catch (error) {
    console.error("Delete service error:", error);
    res.status(500).json({ error: "Failed to delete service" });
  }
});
var tenant_default = router2;

// src/api/bookings.ts
var import_express3 = require("express");
var import_drizzle_orm5 = require("drizzle-orm");
var router3 = (0, import_express3.Router)();
router3.use(requireAuth());
router3.get("/", async (req, res) => {
  const { tenantId, role, userId } = req.user;
  const { date, staff_id } = req.query;
  try {
    let filters = [(0, import_drizzle_orm5.eq)(appointments.tenantId, tenantId)];
    if (role === "staff") {
      const staffMember = await db.select().from(staff).where((0, import_drizzle_orm5.eq)(staff.userId, userId)).get();
      if (staffMember) {
        filters.push((0, import_drizzle_orm5.eq)(appointments.staffId, staffMember.id));
      }
    } else if (staff_id) {
      filters.push((0, import_drizzle_orm5.eq)(appointments.staffId, staff_id));
    }
    if (date) {
      const startOfDay = (/* @__PURE__ */ new Date(`${date}T00:00:00.000Z`)).getTime();
      const endOfDay = (/* @__PURE__ */ new Date(`${date}T23:59:59.999Z`)).getTime();
      filters.push((0, import_drizzle_orm5.gte)(appointments.startTime, startOfDay));
      filters.push((0, import_drizzle_orm5.lte)(appointments.startTime, endOfDay));
    }
    const results = await db.select({
      id: appointments.id,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      customerEmail: appointments.customerEmail,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      staffName: staff.name,
      serviceName: services.name,
      servicePrice: services.price
    }).from(appointments).leftJoin(staff, (0, import_drizzle_orm5.eq)(appointments.staffId, staff.id)).leftJoin(services, (0, import_drizzle_orm5.eq)(appointments.serviceId, services.id)).where((0, import_drizzle_orm5.and)(...filters)).orderBy((0, import_drizzle_orm5.desc)(appointments.startTime)).all();
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});
router3.put("/:id/status", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { status } = req.body;
  try {
    const appointment = await db.select().from(appointments).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(appointments.id, id), (0, import_drizzle_orm5.eq)(appointments.tenantId, tenantId))).get();
    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    await db.update(appointments).set({ status }).where((0, import_drizzle_orm5.eq)(appointments.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
});
router3.get("/:id", async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  try {
    const result = await db.select({
      id: appointments.id,
      customerName: appointments.customerName,
      customerPhone: appointments.customerPhone,
      customerEmail: appointments.customerEmail,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      staffName: staff.name,
      serviceName: services.name,
      servicePrice: services.price
    }).from(appointments).leftJoin(staff, (0, import_drizzle_orm5.eq)(appointments.staffId, staff.id)).leftJoin(services, (0, import_drizzle_orm5.eq)(appointments.serviceId, services.id)).where((0, import_drizzle_orm5.and)((0, import_drizzle_orm5.eq)(appointments.id, id), (0, import_drizzle_orm5.eq)(appointments.tenantId, tenantId))).get();
    if (!result) {
      return res.status(404).json({ error: "Appointment not found" });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});
var bookings_default = router3;

// src/api/public.ts
var import_express4 = require("express");
var import_drizzle_orm6 = require("drizzle-orm");
var import_zod = require("zod");
var import_crypto4 = __toESM(require("crypto"), 1);

// server/lib/chapa.ts
var import_chapa_nodejs = require("chapa-nodejs");
var cached = null;
function initChapa() {
  if (cached) return cached;
  let secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CHAPA_SECRET_KEY is required in production");
    }
    secretKey = "CHASECK_TEST-g3pDAuHMdioBphvmSN0ETveYu5KPaDD5";
  }
  cached = new import_chapa_nodejs.Chapa({
    secretKey,
    debug: process.env.CHAPA_DEBUG === "true",
    logging: false,
    timeout: 3e4
  });
  return cached;
}
async function initiateDirectCharge(phone, amountBirr, tx_ref, firstName, lastName, email) {
  const chapa = initChapa();
  const response = await chapa.directCharge({
    mobile: phone,
    amount: amountBirr,
    tx_ref,
    currency: "ETB",
    type: "telebirr",
    first_name: firstName,
    last_name: lastName,
    email
  });
  if (response.status !== "success" || !response.data?.meta?.ref_id) {
    throw new Error(
      `Chapa directCharge failed: ${response.message || "unknown error"} (status=${response.status})`
    );
  }
  return {
    ref_id: response.data.meta.ref_id,
    raw: response
  };
}
async function authorizeDirectCharge(reference) {
  const chapa = initChapa();
  const response = await chapa.authorizeDirectCharge({
    reference,
    client: "",
    type: "telebirr"
  });
  if (!response.trx_ref) {
    throw new Error(
      `Chapa authorizeDirectCharge failed: ${response.message || "no trx_ref returned"}`
    );
  }
  return {
    trx_ref: response.trx_ref,
    raw: response
  };
}
async function verifyPayment(tx_ref) {
  const chapa = initChapa();
  const response = await chapa.verify({ tx_ref });
  return {
    status: response.data?.status || response.status || "pending",
    amount: response.data?.amount || "",
    tx_ref: response.data?.tx_ref || tx_ref,
    raw: response
  };
}
function generateTxRef(prefix) {
  const chapa = initChapa();
  return chapa.genTxRef(prefix ? { prefix } : void 0);
}
function getWebhookSecret() {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CHAPA_WEBHOOK_SECRET is required in production");
    }
    return "CyNDCzoXF7JsaPig6GErkdT0";
  }
  return secret;
}

// server/lib/timezone.ts
var ADDIS_OFFSET_MS = 3 * 60 * 60 * 1e3;
function getAddisDayOfWeek(utc) {
  const addis = new Date(utc.getTime() + ADDIS_OFFSET_MS);
  return addis.getUTCDay();
}
function getAddisDateString(utc) {
  const addis = new Date(utc.getTime() + ADDIS_OFFSET_MS);
  const y = addis.getUTCFullYear();
  const m = String(addis.getUTCMonth() + 1).padStart(2, "0");
  const d = String(addis.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function parseAddisDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d, 0, 0, 0);
  return new Date(utcMidnight - ADDIS_OFFSET_MS);
}
function formatAddisSlotTime(utcMs) {
  const addis = new Date(utcMs + ADDIS_OFFSET_MS);
  return `${String(addis.getUTCHours()).padStart(2, "0")}:${String(addis.getUTCMinutes()).padStart(2, "0")}`;
}

// server/lib/turnstile.ts
var VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
var TurnstileNotConfiguredError = class extends Error {
};
function isTurnstileConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY?.trim());
}
async function verifyTurnstileToken(token, remoteip) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) throw new TurnstileNotConfiguredError("TURNSTILE_SECRET_KEY not set");
  const body = new URLSearchParams();
  body.append("secret", secret);
  if (token) body.append("response", token);
  if (remoteip) body.append("remoteip", remoteip);
  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    if (!res.ok) {
      return { success: false, "error-codes": ["verify-http-" + res.status] };
    }
    return await res.json();
  } catch (err) {
    return { success: false, "error-codes": ["verify-transport-" + String(err?.name || "unknown")] };
  }
}

// src/api/public.ts
var router4 = (0, import_express4.Router)();
router4.get("/discover", publicReadLimiter, async (_req, res) => {
  try {
    const rows = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      category: tenants.category,
      settings: tenants.settings,
      createdAt: tenants.createdAt
    }).from(tenants).where((0, import_drizzle_orm6.eq)(tenants.isListed, true)).orderBy(tenants.name).all();
    if (rows.length === 0) {
      return res.json([]);
    }
    const tenantIds = rows.map((r) => r.id);
    const [pageRows, bookingRows] = await Promise.all([
      db.select({ tenantId: pages.tenantId, content: pages.content }).from(pages).where((0, import_drizzle_orm6.inArray)(pages.tenantId, tenantIds)).all(),
      db.select({
        tenantId: appointments.tenantId,
        n: import_drizzle_orm6.sql`count(*)`.as("n")
      }).from(appointments).where(
        (0, import_drizzle_orm6.and)(
          (0, import_drizzle_orm6.inArray)(appointments.tenantId, tenantIds),
          (0, import_drizzle_orm6.inArray)(appointments.status, ["confirmed", "completed"])
        )
      ).groupBy(appointments.tenantId).all()
    ]);
    const heroByTenant = /* @__PURE__ */ new Map();
    for (const p of pageRows) {
      heroByTenant.set(p.tenantId, extractHeroImage(p.content));
    }
    const countByTenant = /* @__PURE__ */ new Map();
    for (const b of bookingRows) countByTenant.set(b.tenantId, Number(b.n));
    const out = rows.map((r) => {
      const settings = r.settings || {};
      const city = settings.city ? String(settings.city).trim() || null : null;
      const realBookings = countByTenant.get(r.id) || 0;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        category: r.category,
        city,
        heroImage: pickTenantMedia(heroByTenant.get(r.id) || null),
        isNew: realBookings === 0,
        createdAt: r.createdAt
      };
    });
    res.json(out);
  } catch (error) {
    console.error("Discover error:", error);
    res.status(500).json({ error: "Failed to fetch discover listing" });
  }
});
router4.get("/turnstile-config", (_req, res) => {
  res.json({ siteKey: process.env.TURNSTILE_SITE_KEY?.trim() || null });
});
function extractHeroImage(pageContent) {
  if (!pageContent || typeof pageContent !== "object") return null;
  const blocks = Array.isArray(pageContent.content) ? pageContent.content : Array.isArray(pageContent.blocks) ? pageContent.blocks : [];
  for (const b of blocks) {
    if (b && b.type === "Hero" && b.props) {
      const img = b.props.backgroundImage;
      if (typeof img === "string" && img.trim()) return img.trim();
    }
  }
  return null;
}
function pickTenantMedia(url) {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("/api/uploads/")) {
    return trimmed;
  }
  return null;
}
router4.use(async (req, res, next) => {
  let slug = req.headers["x-tenant-slug"];
  if (!slug) {
    const host2 = req.headers.host || "";
    slug = host2.split(".")[0];
  }
  if (!slug) {
    return res.status(400).json({ error: "Tenant slug not found" });
  }
  const rawSlug = String(slug).trim();
  const tenant = await db.select().from(tenants).where((0, import_drizzle_orm6.or)((0, import_drizzle_orm6.eq)(tenants.slug, rawSlug), (0, import_drizzle_orm6.eq)(tenants.slug, rawSlug.toLowerCase()))).get();
  if (!tenant) {
    return res.status(404).json({ error: "Tenant not found" });
  }
  if (tenant.isSuspended) {
    logSecurityEvent({
      type: "suspended_tenant_request",
      tenantId: tenant.id,
      ip: ipFromRequest(req),
      details: { path: req.path }
    });
    return res.status(403).json({ error: "This business has been suspended", code: "TENANT_SUSPENDED" });
  }
  req.tenant = tenant;
  next();
});
router4.use(publicReadLimiter);
router4.get("/business-hours", async (req, res) => {
  const tenant = req.tenant;
  try {
    const hours = await db.select().from(tenantBusinessHours).where((0, import_drizzle_orm6.eq)(tenantBusinessHours.tenantId, tenant.id)).all();
    res.json(hours);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch business hours" });
  }
});
router4.get("/page", async (req, res) => {
  const tenant = req.tenant;
  try {
    const page = await db.select().from(pages).where((0, import_drizzle_orm6.eq)(pages.tenantId, tenant.id)).get();
    res.json({ tenant, page });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch page data" });
  }
});
router4.get("/services", async (req, res) => {
  const tenant = req.tenant;
  try {
    const tenantServices = await db.select().from(services).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(services.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(services.active, true))).all();
    res.json(tenantServices);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch services" });
  }
});
router4.get("/staff", async (req, res) => {
  const tenant = req.tenant;
  const serviceId = req.query.service_id;
  try {
    let query = db.select({
      id: staff.id,
      name: staff.name,
      title: staff.title,
      bio: staff.bio,
      imagePath: staff.imagePath
    }).from(staff).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(staff.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(staff.active, true)));
    const staffMembers = await query.all();
    if (serviceId) {
      const mappings = await getStaffServicesForServiceInTenant(tenant.id, serviceId);
      const staffIds = new Set(mappings.map((m) => m.staffId));
      const filtered = staffMembers.filter((s) => staffIds.has(s.id));
      return res.json(filtered);
    }
    res.json(staffMembers);
  } catch (error) {
    console.error("Failed to fetch staff:", error);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});
async function getStaffServicesForServiceInTenant(tenantId, serviceId) {
  const tenantStaff = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm6.eq)(staff.tenantId, tenantId)).all();
  if (!tenantStaff.length) return [];
  const staffIds = tenantStaff.map((s) => s.id);
  return db.select().from(staffServices).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(staffServices.serviceId, serviceId), (0, import_drizzle_orm6.inArray)(staffServices.staffId, staffIds))).all();
}
router4.get("/availability", async (req, res) => {
  const tenant = req.tenant;
  const { staff_id, date } = req.query;
  if (!staff_id || !date) {
    return res.status(400).json({ error: "staff_id and date are required" });
  }
  try {
    const ownedStaff = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(staff.id, staff_id), (0, import_drizzle_orm6.eq)(staff.tenantId, tenant.id))).get();
    if (!ownedStaff) {
      logSecurityEvent({
        type: "cross_tenant_attempt",
        tenantId: tenant.id,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: staff_id }
      });
      return res.json([]);
    }
    const addisMidnight = parseAddisDate(date);
    const addisDayEnd = new Date(addisMidnight.getTime() + 24 * 3600 * 1e3);
    const dayOfWeek = getAddisDayOfWeek(addisMidnight);
    const dateString = getAddisDateString(addisMidnight);
    if (addisDayEnd.getTime() <= Date.now()) {
      return res.status(422).json({
        error: "Cannot fetch availability for a past date.",
        code: "PAST_DATE"
      });
    }
    const closures = await db.select().from(tenantClosures).where(
      (0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(tenantClosures.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(tenantClosures.date, dateString))
    ).all();
    if (closures.length > 0) {
      return res.status(422).json({
        error: "The business is closed on this date.",
        code: "CLOSED_DATE"
      });
    }
    const businessHours = await db.select().from(tenantBusinessHours).where(
      (0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(tenantBusinessHours.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(tenantBusinessHours.dayOfWeek, dayOfWeek))
    ).get();
    if (businessHours?.isClosed) {
      return res.status(422).json({
        error: "The business is closed on this day of the week.",
        code: "CLOSED_DAY"
      });
    }
    const tOpen = businessHours?.openTime || "00:00";
    const tClose = businessHours?.closeTime || "23:59";
    const availabilities = await db.select().from(staffAvailability).where(
      (0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(staffAvailability.staffId, staff_id), (0, import_drizzle_orm6.eq)(staffAvailability.dayOfWeek, dayOfWeek))
    ).all();
    if (availabilities.length === 0) {
      return res.json([]);
    }
    const staffAppointments = await db.select().from(appointments).where(
      (0, import_drizzle_orm6.and)(
        (0, import_drizzle_orm6.eq)(appointments.staffId, staff_id),
        (0, import_drizzle_orm6.eq)(appointments.tenantId, tenant.id),
        (0, import_drizzle_orm6.or)((0, import_drizzle_orm6.eq)(appointments.status, "confirmed"), (0, import_drizzle_orm6.eq)(appointments.status, "pending")),
        (0, import_drizzle_orm6.gte)(appointments.startTime, addisMidnight.getTime() - 36e5),
        (0, import_drizzle_orm6.lt)(appointments.startTime, addisDayEnd.getTime() + 36e5)
      )
    ).all();
    const parseTime = (t) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const slots = [];
    for (const avail of availabilities) {
      const effStart = avail.startTime > tOpen ? avail.startTime : tOpen;
      const effEnd = avail.endTime < tClose ? avail.endTime : tClose;
      const startMin = parseTime(effStart);
      const endMin = parseTime(effEnd);
      if (startMin >= endMin) continue;
      for (let min = startMin; min < endMin - 29; min += 30) {
        const slotUtcMs = addisMidnight.getTime() + min * 60 * 1e3;
        const slotEndUtcMs = slotUtcMs + 30 * 60 * 1e3;
        const conflict = staffAppointments.some((app2) => {
          return slotUtcMs < app2.endTime && slotEndUtcMs > app2.startTime;
        });
        if (!conflict) {
          slots.push(formatAddisSlotTime(slotUtcMs));
        }
      }
    }
    const uniqueSlots = Array.from(new Set(slots)).sort();
    res.json(uniqueSlots);
  } catch (error) {
    console.error("Availability error:", error);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});
var BookingSchema = import_zod.z.object({
  staff_id: import_zod.z.string().uuid(),
  service_id: import_zod.z.string().uuid(),
  start_time: import_zod.z.string().datetime({ offset: true }),
  customer_name: import_zod.z.string().min(1),
  customer_phone: import_zod.z.string().min(1),
  customer_email: import_zod.z.string().email().optional().or(import_zod.z.literal(""))
});
async function assertSlotAllowed(tenant, startTimeMs) {
  if (!Number.isFinite(startTimeMs)) {
    return { code: "INVALID_TIME", error: "Invalid start_time. Expected an ISO 8601 timestamp." };
  }
  if (startTimeMs <= Date.now()) {
    return { code: "PAST_DATE", error: "Cannot book a time in the past." };
  }
  const slotStartDate = new Date(startTimeMs);
  const slotDayOfWeek = getAddisDayOfWeek(slotStartDate);
  const slotDateString = getAddisDateString(slotStartDate);
  const closures = await db.select().from(tenantClosures).where(
    (0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(tenantClosures.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(tenantClosures.date, slotDateString))
  ).all();
  if (closures.length > 0) {
    return { code: "CLOSED_DATE", error: "The business is closed on this date." };
  }
  const businessHours = await db.select().from(tenantBusinessHours).where(
    (0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(tenantBusinessHours.tenantId, tenant.id), (0, import_drizzle_orm6.eq)(tenantBusinessHours.dayOfWeek, slotDayOfWeek))
  ).get();
  if (businessHours?.isClosed) {
    return { code: "CLOSED_DAY", error: "The business is closed on this day of the week." };
  }
  return null;
}
async function findSlotConflict(tenantId, staffId, startMs, endMs, excludeAppointmentId) {
  const filter = (0, import_drizzle_orm6.and)(
    (0, import_drizzle_orm6.eq)(appointments.tenantId, tenantId),
    (0, import_drizzle_orm6.eq)(appointments.staffId, staffId),
    (0, import_drizzle_orm6.or)((0, import_drizzle_orm6.eq)(appointments.status, "confirmed"), (0, import_drizzle_orm6.eq)(appointments.status, "pending")),
    (0, import_drizzle_orm6.lt)(appointments.startTime, endMs),
    (0, import_drizzle_orm6.gte)(appointments.endTime, startMs)
  );
  const q = db.select({ id: appointments.id }).from(appointments);
  const where = excludeAppointmentId ? (0, import_drizzle_orm6.and)(filter, import_drizzle_orm6.sql`${appointments.id} != ${excludeAppointmentId}`) : filter;
  return q.where(where).get();
}
router4.post("/bookings", bookingWriteLimiter, async (req, res) => {
  const tenant = req.tenant;
  try {
    const data = BookingSchema.parse(req.body);
    if (isTurnstileConfigured()) {
      const token = req.body?.turnstile_token;
      if (!token) {
        return res.status(422).json({ error: "Bot check required. Please verify you are human.", code: "TURNSTILE_MISSING" });
      }
      const verify = await verifyTurnstileToken(token);
      if (!verify.success) {
        return res.status(422).json({ error: "Bot check failed. Please retry the verification.", code: "TURNSTILE_INVALID" });
      }
    }
    const service = await db.select().from(services).where((0, import_drizzle_orm6.eq)(services.id, data.service_id)).get();
    if (!service || service.tenantId !== tenant.id) {
      return res.status(404).json({ error: "Service not found" });
    }
    const staffRow = await db.select({ id: staff.id }).from(staff).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(staff.id, data.staff_id), (0, import_drizzle_orm6.eq)(staff.tenantId, tenant.id))).get();
    if (!staffRow) {
      logSecurityEvent({
        type: "cross_tenant_attempt",
        tenantId: tenant.id,
        ip: ipFromRequest(req),
        details: { path: req.path, staffId: data.staff_id }
      });
      return res.status(404).json({ error: "Staff not found" });
    }
    const customerPhone = normalizePhone(data.customer_phone);
    if (!customerPhone) {
      return res.status(422).json({ error: "Enter a valid Ethiopian phone number" });
    }
    const startTimeMs = new Date(data.start_time).getTime();
    const endTimeMs = startTimeMs + service.durationMinutes * 6e4;
    const slotError = await assertSlotAllowed(tenant, startTimeMs);
    if (slotError) {
      return res.status(422).json(slotError);
    }
    const requiresPayment = tenant.settings?.require_payment_upfront === true;
    const initialStatus = requiresPayment ? "pending" : "confirmed";
    const appId = import_crypto4.default.randomUUID();
    let paymentId = null;
    let txRef = null;
    try {
      await db.transaction(async (tx) => {
        const conflicting = await tx.select().from(appointments).where(
          (0, import_drizzle_orm6.and)(
            (0, import_drizzle_orm6.eq)(appointments.tenantId, tenant.id),
            (0, import_drizzle_orm6.eq)(appointments.staffId, data.staff_id),
            (0, import_drizzle_orm6.or)((0, import_drizzle_orm6.eq)(appointments.status, "confirmed"), (0, import_drizzle_orm6.eq)(appointments.status, "pending")),
            (0, import_drizzle_orm6.lt)(appointments.startTime, endTimeMs),
            (0, import_drizzle_orm6.gte)(appointments.endTime, startTimeMs)
          )
        ).get();
        if (conflicting) {
          throw new Error("CONFLICT");
        }
        await tx.insert(appointments).values({
          id: appId,
          tenantId: tenant.id,
          staffId: data.staff_id,
          serviceId: data.service_id,
          customerName: data.customer_name,
          customerPhone,
          customerEmail: data.customer_email || null,
          startTime: startTimeMs,
          endTime: endTimeMs,
          status: initialStatus,
          reminderSent: false
        });
        if (requiresPayment) {
          txRef = generateTxRef("egebeya-");
          paymentId = import_crypto4.default.randomUUID();
          await tx.insert(payments).values({
            id: paymentId,
            tenantId: tenant.id,
            appointmentId: appId,
            amount: service.price,
            gateway: "chapa",
            method: "telebirr",
            gatewayReference: txRef,
            status: "pending"
          });
        }
      }, { behavior: "immediate" });
    } catch (err) {
      if (err.message === "CONFLICT") {
        return res.status(409).json({ error: "Time slot is no longer available" });
      }
      throw err;
    }
    let finalStatus = initialStatus;
    let paymentStatus = null;
    if (requiresPayment && txRef && paymentId) {
      const amountBirr = (service.price / 100).toFixed(2);
      const firstName = data.customer_name.split(" ")[0] || data.customer_name;
      const lastName = data.customer_name.split(" ").slice(1).join(" ") || void 0;
      try {
        const init = await initiateDirectCharge(
          customerPhone,
          amountBirr,
          txRef,
          firstName,
          lastName,
          data.customer_email || void 0
        );
        await authorizeDirectCharge(init.ref_id);
        let verifiedStatus = "pending";
        try {
          const verification = await verifyPayment(txRef);
          verifiedStatus = verification.status;
        } catch (verifyErr) {
          console.error("Chapa verify failed (leaving as pending):", verifyErr);
        }
        if (verifiedStatus === "success") {
          finalStatus = "confirmed";
          paymentStatus = "completed";
          await db.update(payments).set({ status: "completed" }).where((0, import_drizzle_orm6.eq)(payments.id, paymentId));
          await db.update(appointments).set({ status: "confirmed" }).where((0, import_drizzle_orm6.eq)(appointments.id, appId));
        } else {
          finalStatus = "pending";
          paymentStatus = "pending";
        }
      } catch (chapaErr) {
        console.error("Chapa initiation failed \u2014 rolling back payment+appointment:", chapaErr?.message || chapaErr);
        try {
          await db.delete(payments).where((0, import_drizzle_orm6.eq)(payments.id, paymentId));
        } catch {
        }
        try {
          await db.delete(appointments).where((0, import_drizzle_orm6.eq)(appointments.id, appId));
        } catch {
        }
        return res.status(402).json({
          error: "Payment initiation failed. Booking was not created."
        });
      }
    }
    const result = {
      id: appId,
      status: finalStatus,
      paymentStatus,
      data
    };
    const appointmentDateStr = new Date(startTimeMs).toLocaleString("en-US", { timeZone: "Africa/Addis_Ababa" });
    if (result.data.customer_email) {
      sendMail({
        to: result.data.customer_email,
        subject: `Booking ${result.status}: ${service.name} at ${tenant.name}`,
        text: `Hello ${result.data.customer_name},

Your appointment for ${service.name} is ${result.status}.
Date: ${appointmentDateStr}

Thank you for choosing ${tenant.name}!`
      }).catch(console.error);
    }
    const owner = await db.select().from(users).where((0, import_drizzle_orm6.eq)(users.tenantId, tenant.id)).get();
    if (owner && owner.email) {
      sendMail({
        to: owner.email,
        subject: `New Booking: ${service.name}`,
        text: `A new booking has been made by ${result.data.customer_name} for ${service.name}.
Date: ${appointmentDateStr}`
      }).catch(console.error);
    }
    res.status(201).json({ success: true, appointment: result });
  } catch (error) {
    if (error.message === "CONFLICT") {
      return res.status(409).json({ error: "Time slot is no longer available" });
    }
    if (error instanceof import_zod.z.ZodError) {
      return res.status(422).json({ error: error.issues });
    }
    console.error("Booking error:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
});
async function resolveOwnedBooking(req, res) {
  const tenant = req.tenant;
  const { id } = req.params;
  const phone = normalizePhone(req.body?.customer_phone);
  if (!phone) {
    res.status(400).json({ error: "A valid Ethiopian phone number is required" });
    return null;
  }
  const appt = await db.select().from(appointments).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(appointments.id, id), (0, import_drizzle_orm6.eq)(appointments.tenantId, tenant.id))).get();
  if (!appt) {
    res.status(404).json({ error: "Booking not found" });
    return null;
  }
  if (appt.customerPhone !== phone) {
    res.status(403).json({ error: "Phone number does not match this booking" });
    return null;
  }
  return appt;
}
router4.post("/bookings/:id/cancel", bookingWriteLimiter, async (req, res) => {
  const tenant = req.tenant;
  try {
    const appt = await resolveOwnedBooking(req, res);
    if (!appt) return;
    if (!["pending", "confirmed"].includes(appt.status)) {
      return res.status(400).json({ error: "Only pending or confirmed bookings can be cancelled." });
    }
    await db.update(appointments).set({ status: "cancelled" }).where((0, import_drizzle_orm6.eq)(appointments.id, appt.id));
    const payment = await db.select().from(payments).where((0, import_drizzle_orm6.eq)(payments.appointmentId, appt.id)).get();
    res.json({
      success: true,
      status: "cancelled",
      refundNote: payment && payment.status === "completed" ? "A refund must be issued manually by the business." : void 0
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ error: "Failed to cancel booking" });
  }
});
router4.post("/bookings/:id/reschedule", bookingWriteLimiter, async (req, res) => {
  const tenant = req.tenant;
  try {
    const appt = await resolveOwnedBooking(req, res);
    if (!appt) return;
    if (appt.status === "cancelled") {
      return res.status(400).json({ error: "Cancelled bookings cannot be rescheduled." });
    }
    const { start_time } = req.body;
    if (!start_time) {
      return res.status(400).json({ error: "start_time is required" });
    }
    const startTimeMs = new Date(start_time).getTime();
    if (!Number.isFinite(startTimeMs)) {
      return res.status(422).json({ error: "Invalid start_time. Expected an ISO 8601 timestamp." });
    }
    const service = await db.select().from(services).where((0, import_drizzle_orm6.and)((0, import_drizzle_orm6.eq)(services.id, appt.serviceId), (0, import_drizzle_orm6.eq)(services.tenantId, tenant.id))).get();
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    const endTimeMs = startTimeMs + service.durationMinutes * 6e4;
    const slotError = await assertSlotAllowed(tenant, startTimeMs);
    if (slotError) return res.status(422).json(slotError);
    const conflict = await findSlotConflict(tenant.id, appt.staffId, startTimeMs, endTimeMs, appt.id);
    if (conflict) {
      return res.status(409).json({ error: "That time is no longer available" });
    }
    const requiresPayment = tenant.settings?.require_payment_upfront === true;
    const newStatus = requiresPayment ? "pending" : "confirmed";
    await db.update(appointments).set({
      startTime: startTimeMs,
      endTime: endTimeMs,
      status: newStatus
    }).where((0, import_drizzle_orm6.eq)(appointments.id, appt.id));
    res.json({ success: true, appointment: { id: appt.id, startTime: startTimeMs, endTime: endTimeMs, status: newStatus } });
  } catch (error) {
    console.error("Reschedule booking error:", error);
    res.status(500).json({ error: "Failed to reschedule booking" });
  }
});
router4.get("/appointments", async (req, res) => {
  const tenant = req.tenant;
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "date query parameter (YYYY-MM-DD) is required" });
  }
  try {
    const addisMidnight = parseAddisDate(date);
    const addisDayEnd = new Date(addisMidnight.getTime() + 24 * 3600 * 1e3);
    const rows = await db.select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      serviceName: services.name
    }).from(appointments).leftJoin(services, (0, import_drizzle_orm6.eq)(appointments.serviceId, services.id)).where(
      (0, import_drizzle_orm6.and)(
        (0, import_drizzle_orm6.eq)(appointments.tenantId, tenant.id),
        (0, import_drizzle_orm6.or)((0, import_drizzle_orm6.eq)(appointments.status, "confirmed"), (0, import_drizzle_orm6.eq)(appointments.status, "pending")),
        (0, import_drizzle_orm6.gte)(appointments.startTime, addisMidnight.getTime()),
        (0, import_drizzle_orm6.lt)(appointments.startTime, addisDayEnd.getTime())
      )
    ).all();
    const publicRows = rows.map((r) => ({
      id: r.id,
      startTime: formatAddisSlotTime(r.startTime),
      status: r.status,
      serviceName: r.serviceName
    })).sort((a, b) => a.startTime.localeCompare(b.startTime));
    res.json(publicRows);
  } catch (error) {
    console.error("Public appointments error:", error);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});
var public_default = router4;

// src/api/payments.ts
var import_express5 = require("express");
var import_drizzle_orm7 = require("drizzle-orm");
var import_chapa_nodejs2 = require("chapa-nodejs");
var import_crypto5 = __toESM(require("crypto"), 1);
var router5 = (0, import_express5.Router)();
function verifyChapaSignature(rawBody, signature, secret) {
  if (!signature) return false;
  try {
    const ok = (0, import_chapa_nodejs2.verifyWebhookSignature)(rawBody, signature, secret);
    if (typeof ok === "boolean") return ok;
  } catch (err) {
    console.warn("[webhook] verifyWebhookSignature threw, falling back to manual HMAC:", err);
  }
  const expected = import_crypto5.default.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return import_crypto5.default.timingSafeEqual(a, b);
}
function eventIdFor(body, txRef) {
  if (typeof body?.reference === "string" && body.reference.trim()) {
    return `ref:${body.reference}`;
  }
  return `tx:${txRef}`;
}
router5.post("/webhook", webhookLimiter, async (req, res) => {
  try {
    const rawBody = req.rawBody ? Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody) : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const signature = req.headers["x-chapa-signature"] || req.headers["chapa-signature"];
    let webhookSecret;
    try {
      webhookSecret = getWebhookSecret();
    } catch {
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    if (!signature) {
      logSecurityEvent({
        type: "webhook_signature_rejected",
        ip: ipFromRequest(req),
        details: { reason: "missing signature" }
      });
      return res.status(401).json({ error: "Missing webhook signature" });
    }
    if (!verifyChapaSignature(rawBody, signature, webhookSecret)) {
      logSecurityEvent({
        type: "webhook_signature_rejected",
        ip: ipFromRequest(req),
        details: { reason: "invalid signature" }
      });
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
    const { tx_ref, status } = req.body || {};
    if (!tx_ref || typeof tx_ref !== "string") {
      return res.status(400).json({ error: "Missing tx_ref" });
    }
    const payment = await db.select().from(payments).where((0, import_drizzle_orm7.eq)(payments.gatewayReference, tx_ref)).get();
    if (!payment) {
      return res.status(404).json({ error: "Payment not found for tx_ref" });
    }
    const eventId = eventIdFor(req.body, tx_ref);
    const provider = "chapa";
    const dup = await db.select({ id: processedWebhookEvents.id }).from(processedWebhookEvents).where((0, import_drizzle_orm7.and)((0, import_drizzle_orm7.eq)(processedWebhookEvents.provider, provider), (0, import_drizzle_orm7.eq)(processedWebhookEvents.eventId, eventId))).get();
    if (dup) {
      return res.json({ success: true, duplicate: true });
    }
    let verifiedStatus = status || "pending";
    try {
      const verification = await verifyPayment(tx_ref);
      if (verification.status === "success" || verification.status === "completed") {
        verifiedStatus = "completed";
      } else if (verification.status === "failed") {
        verifiedStatus = "failed";
      }
    } catch (verifyErr) {
      console.error("Webhook: Chapa verify failed, falling back to declared status:", verifyErr?.message || verifyErr);
      if (status === "success" || status === "completed") {
        verifiedStatus = "completed";
      } else if (status === "failed") {
        verifiedStatus = "failed";
      }
    }
    try {
      await db.insert(processedWebhookEvents).values({
        id: import_crypto5.default.randomUUID(),
        provider,
        eventId,
        txRef: tx_ref,
        paymentId: payment.id,
        action: verifiedStatus,
        raw: JSON.stringify(req.body),
        receivedAt: Date.now()
      });
    } catch (insertErr) {
      if (String(insertErr?.code || "").includes("SQLITE_CONSTRAINT") || String(insertErr?.message || "").includes("UNIQUE")) {
        return res.json({ success: true, duplicate: true });
      }
      throw insertErr;
    }
    const previousStatus = payment.status;
    await db.update(payments).set({ status: verifiedStatus }).where((0, import_drizzle_orm7.eq)(payments.id, payment.id));
    if (verifiedStatus === "completed" && payment.appointmentId) {
      await db.update(appointments).set({ status: "confirmed" }).where((0, import_drizzle_orm7.eq)(appointments.id, payment.appointmentId));
    } else if (verifiedStatus === "failed" && payment.appointmentId) {
      await db.update(appointments).set({ status: "cancelled" }).where((0, import_drizzle_orm7.eq)(appointments.id, payment.appointmentId));
    }
    res.json({ success: true, previousStatus, status: verifiedStatus });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Failed to process webhook" });
  }
});
var payments_default = router5;

// src/api/test.ts
var import_express6 = require("express");
var router6 = (0, import_express6.Router)();
router6.use(requireAuth({ roles: ["owner"] }));
router6.post("/send-email", async (req, res) => {
  const { to } = req.body;
  if (!to) return res.status(400).json({ error: "Recipient email is required" });
  try {
    const info = await sendMail({
      to,
      subject: "Test Email from Lux Nails & Spa",
      text: "This is a test email to verify connectivity."
    });
    res.json({ success: true, message: "Test email sent successfully", info });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email", details: error.message });
  }
});
var test_default = router6;

// src/api/pro-site.ts
var import_express7 = require("express");
var import_drizzle_orm8 = require("drizzle-orm");
var import_crypto6 = __toESM(require("crypto"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var router7 = (0, import_express7.Router)();
var TEMPLATE_DIR = import_path2.default.join(process.cwd(), "server", "templates", "pro-starter");
router7.use(requireAuth({ roles: ["owner"] }));
router7.use(tenantWriteLimiter);
async function requireProPlan(req, res) {
  const { tenantId } = req.user;
  const subscription = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm8.eq)(tenantSubscriptions.tenantId, tenantId)).get();
  if (!subscription) {
    res.status(403).json({ error: "No active subscription. Complete setup first.", code: "PLAN_REQUIRED" });
    return null;
  }
  if (subscription.status !== "active" && subscription.status !== "trial") {
    res.status(403).json({ error: "An active subscription is required.", code: "PLAN_REQUIRED" });
    return null;
  }
  const plan = subscription.planId ? await db.select().from(plans).where((0, import_drizzle_orm8.eq)(plans.id, subscription.planId)).get() : null;
  if (!plan || (plan.name ?? "").toLowerCase() !== "pro") {
    res.status(403).json({ error: "The code editor is available on the Pro plan only.", code: "PLAN_REQUIRED" });
    return null;
  }
  if (subscription.status === "trial" && typeof subscription.trialEndsAt === "number" && subscription.trialEndsAt <= Date.now()) {
    res.status(403).json({ error: "Your Pro trial has expired. Renew to keep using the code editor.", code: "TRIAL_EXPIRED" });
    return null;
  }
  return plan;
}
router7.post("/subscription/upgrade", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const allPlans = await db.select().from(plans).all();
    const proPlan = allPlans.find((p) => (p.name ?? "").toLowerCase() === "pro");
    if (!proPlan) {
      return res.status(500).json({ error: "Pro plan is not configured on this platform." });
    }
    const existing = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm8.eq)(tenantSubscriptions.tenantId, tenantId)).get();
    const now = Date.now();
    const trialEndsAt = now + 14 * 24 * 3600 * 1e3;
    if (existing) {
      const alreadyProTrial = existing.planId === proPlan.id && existing.status === "trial";
      if (!alreadyProTrial) {
        await db.update(tenantSubscriptions).set({
          planId: proPlan.id,
          status: "trial",
          trialEndsAt,
          startsAt: now
        }).where((0, import_drizzle_orm8.eq)(tenantSubscriptions.tenantId, tenantId));
      }
    } else {
      await db.insert(tenantSubscriptions).values({
        id: import_crypto6.default.randomUUID(),
        tenantId,
        planId: proPlan.id,
        status: "trial",
        trialEndsAt,
        startsAt: now
      });
    }
    const subscription = await db.select().from(tenantSubscriptions).where((0, import_drizzle_orm8.eq)(tenantSubscriptions.tenantId, tenantId)).get();
    const plan = subscription?.planId ? await db.select().from(plans).where((0, import_drizzle_orm8.eq)(plans.id, subscription.planId)).get() : null;
    res.json({
      success: true,
      unchanged: existing?.planId === proPlan.id && existing.status === "trial",
      plan,
      subscription
    });
  } catch (error) {
    console.error("Upgrade error:", error);
    res.status(500).json({ error: "Failed to upgrade subscription" });
  }
});
function readTemplateFiles() {
  const out = {};
  function walk(dir, base) {
    const entries = import_fs2.default.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = import_path2.default.join(dir, e.name);
      const rel = base ? `${base}/${e.name}` : e.name;
      if (e.isDirectory()) {
        walk(full, rel);
      } else {
        out[rel.replace(/\\/g, "/")] = import_fs2.default.readFileSync(full, "utf8");
      }
    }
  }
  walk(TEMPLATE_DIR, "");
  return out;
}
router7.post("/pro-site/init", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const existing = await db.select({ id: proSiteFiles.id }).from(proSiteFiles).where((0, import_drizzle_orm8.eq)(proSiteFiles.tenantId, tenantId)).all();
    if (existing.length > 0) {
      return res.json({ success: true, seeded: false, count: existing.length });
    }
    if (!import_fs2.default.existsSync(TEMPLATE_DIR)) {
      return res.status(500).json({ error: "Starter template not found on the server." });
    }
    const files = readTemplateFiles();
    const now = Date.now();
    const rows = Object.entries(files).map(([filePath, content]) => ({
      id: import_crypto6.default.randomUUID(),
      tenantId,
      filePath,
      content,
      updatedAt: now
    }));
    if (rows.length > 0) {
      await db.insert(proSiteFiles).values(rows);
    }
    res.json({ success: true, seeded: true, count: rows.length });
  } catch (error) {
    console.error("Pro-site init error:", error);
    res.status(500).json({ error: "Failed to initialise pro site" });
  }
});
router7.get("/pro-site/files", async (req, res) => {
  const { tenantId } = req.user;
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const rows = await db.select().from(proSiteFiles).where((0, import_drizzle_orm8.eq)(proSiteFiles.tenantId, tenantId)).all();
    const out = {};
    for (const r of rows) out[r.filePath] = r.content;
    res.json(out);
  } catch (error) {
    console.error("Pro-site fetch error:", error);
    res.status(500).json({ error: "Failed to fetch pro site files" });
  }
});
router7.put("/pro-site/files", async (req, res) => {
  const { tenantId } = req.user;
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "Body must be a { path: content } object" });
  }
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const entries = Object.entries(body);
    const validated = entries.filter(
      ([p, c]) => typeof p === "string" && p.trim().length > 0 && typeof c === "string"
    );
    if (validated.length === 0) {
      return res.status(400).json({ error: "No valid files provided" });
    }
    const now = Date.now();
    for (const [filePath, content] of validated) {
      const existing = await db.select({ id: proSiteFiles.id }).from(proSiteFiles).where((0, import_drizzle_orm8.and)((0, import_drizzle_orm8.eq)(proSiteFiles.tenantId, tenantId), (0, import_drizzle_orm8.eq)(proSiteFiles.filePath, filePath))).get();
      if (existing) {
        await db.update(proSiteFiles).set({ content, updatedAt: now }).where((0, import_drizzle_orm8.eq)(proSiteFiles.id, existing.id));
      } else {
        await db.insert(proSiteFiles).values({
          id: import_crypto6.default.randomUUID(),
          tenantId,
          filePath,
          content,
          updatedAt: now
        });
      }
    }
    res.json({ success: true, count: validated.length });
  } catch (error) {
    console.error("Pro-site upsert error:", error);
    res.status(500).json({ error: "Failed to save pro site files" });
  }
});
var pro_site_default = router7;

// src/api/site-settings.ts
var import_express8 = require("express");
var import_drizzle_orm9 = require("drizzle-orm");

// src/lib/sanitizePublishedCode.ts
var purifyInstance = null;
async function getDOMPurify() {
  if (purifyInstance) return purifyInstance;
  const createDOMPurify = (await import("dompurify")).default;
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    purifyInstance = createDOMPurify(window);
  } else {
    const { JSDOM } = await import("jsdom");
    purifyInstance = createDOMPurify(new JSDOM("").window);
  }
  const EgebeyaWidgetOrigin = "https://api.egebeya.et/";
  purifyInstance.addHook("uponSanitizeAttribute", (node, data) => {
    if (node.tagName?.toLowerCase() !== "iframe") return;
    if (data.attrName !== "src") return;
    const value = (data.attrValue || "").trim();
    if (value === "") {
      data.keepAttr = false;
      return;
    }
    if (!value.startsWith(EgebeyaWidgetOrigin)) {
      data.keepAttr = false;
      return;
    }
  });
  return purifyInstance;
}
var IframeAttrs = [
  "src",
  "width",
  "height",
  "frameborder",
  "allow",
  "allowfullscreen",
  "title",
  "loading"
];
var AllowedTags = [
  "iframe",
  "html",
  "head",
  "body",
  "title",
  "meta",
  "link",
  "style",
  "div",
  "span",
  "header",
  "footer",
  "nav",
  "main",
  "section",
  "article",
  "aside",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "img",
  "a",
  "figure",
  "figcaption",
  "picture",
  "source",
  "video",
  "audio",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "form",
  "label",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "blockquote",
  "pre",
  "code"
];
async function sanitizePublishedCode(rawHtml) {
  const DOMPurify = await getDOMPurify();
  const input = rawHtml ?? "";
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: AllowedTags,
    ALLOWED_ATTR: [
      ...IframeAttrs,
      "class",
      "id",
      "style",
      "href",
      "rel",
      "target",
      "alt",
      "title",
      "name",
      "content",
      "charset",
      "srcset",
      "sizes",
      "width",
      "height",
      "type",
      "placeholder",
      "value",
      "required",
      "disabled",
      "checked",
      "selected",
      "for",
      "colspan",
      "rowspan",
      "controls",
      "autoplay",
      "loop",
      "muted",
      "preload",
      "poster",
      "crossorigin",
      "loading",
      "decoding",
      "role",
      "aria-label",
      "aria-labelledby",
      "aria-describedby",
      "aria-hidden",
      "aria-expanded",
      "aria-controls",
      "data-business-id"
    ],
    FORBID_ATTR: [],
    ALLOW_DATA_ATTR: false
  });
}

// src/api/site-settings.ts
var router8 = (0, import_express8.Router)();
router8.use(requireAuth({ roles: ["owner"] }));
router8.use(tenantWriteLimiter);
router8.get("/site", async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const row = await db.select().from(siteConfig).where((0, import_drizzle_orm9.eq)(siteConfig.tenantId, tenantId)).get();
    if (!row) {
      return res.json({
        tenantId,
        builderMode: "puck",
        publishedCodeHtml: null
      });
    }
    res.json({
      tenantId: row.tenantId,
      builderMode: row.builderMode,
      publishedCodeHtml: row.publishedCodeHtml ?? null,
      updatedAt: row.updatedAt
    });
  } catch (err) {
    console.error("[site-settings] GET failed:", err);
    res.status(500).json({ error: "Failed to fetch site config" });
  }
});
router8.patch("/site", async (req, res) => {
  try {
    const plan = await requireProPlan(req, res);
    if (!plan) return;
    const tenantId = req.user.tenantId;
    const { builderMode, publishedCodeHtml } = req.body;
    if (builderMode !== void 0 && builderMode !== "puck" && builderMode !== "code") {
      return res.status(400).json({ error: 'builderMode must be "puck" or "code"' });
    }
    let safeHtml = null;
    if (publishedCodeHtml !== void 0) {
      if (publishedCodeHtml === null) {
        safeHtml = null;
      } else if (typeof publishedCodeHtml === "string") {
        try {
          safeHtml = await sanitizePublishedCode(publishedCodeHtml);
        } catch (sanitizeErr) {
          console.error("[site-settings] sanitize failed, refusing to store raw HTML:", sanitizeErr);
          return res.status(400).json({ error: "Published HTML could not be sanitized." });
        }
      } else {
        return res.status(400).json({ error: "publishedCodeHtml must be a string or null" });
      }
    }
    const now = Date.now();
    const existing = await db.select().from(siteConfig).where((0, import_drizzle_orm9.eq)(siteConfig.tenantId, tenantId)).get();
    if (existing) {
      const updates = { updatedAt: now };
      if (builderMode !== void 0) updates.builderMode = builderMode;
      if (publishedCodeHtml !== void 0) updates.publishedCodeHtml = safeHtml;
      await db.update(siteConfig).set(updates).where((0, import_drizzle_orm9.eq)(siteConfig.tenantId, tenantId));
    } else {
      await db.insert(siteConfig).values({
        tenantId,
        builderMode: builderMode ?? "puck",
        publishedCodeHtml: publishedCodeHtml !== void 0 ? safeHtml : null,
        updatedAt: now
      });
    }
    const updated = await db.select().from(siteConfig).where((0, import_drizzle_orm9.eq)(siteConfig.tenantId, tenantId)).get();
    res.json({
      tenantId: updated.tenantId,
      builderMode: updated.builderMode,
      publishedCodeHtml: updated.publishedCodeHtml ?? null,
      updatedAt: updated.updatedAt
    });
  } catch (err) {
    console.error("[site-settings] PATCH failed:", err);
    res.status(500).json({ error: "Failed to update site config" });
  }
});
var site_settings_default = router8;

// src/api/admin.ts
var import_express9 = require("express");
var import_drizzle_orm10 = require("drizzle-orm");
var router9 = (0, import_express9.Router)();
router9.use(requireAuth());
router9.use(adminWriteLimiter);
router9.use(async (req, res, next) => {
  try {
    const user2 = await db.select().from(users).where((0, import_drizzle_orm10.eq)(users.id, req.user.userId)).get();
    if (!user2) {
      return res.status(401).json({ error: "User not found" });
    }
    if (!user2.isSuperadmin) {
      return res.status(403).json({ error: "Forbidden \u2014 superadmin only" });
    }
    req.user = {
      userId: user2.id,
      tenantId: user2.tenantId,
      role: user2.role,
      name: user2.name,
      email: user2.email
    };
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});
router9.get("/stats", async (_req, res) => {
  try {
    const tenantRow = await db.select({ n: import_drizzle_orm10.sql`count(*)`.as("n") }).from(tenants).get();
    const bookingRow = await db.select({ n: import_drizzle_orm10.sql`count(*)`.as("n") }).from(appointments).get();
    const suspendedRow = await db.select({ n: import_drizzle_orm10.sql`count(*)`.as("n") }).from(tenants).where((0, import_drizzle_orm10.eq)(tenants.isSuspended, true)).get();
    res.json({
      tenants: Number(tenantRow?.n ?? 0),
      bookings: Number(bookingRow?.n ?? 0),
      suspended: Number(suspendedRow?.n ?? 0)
    });
  } catch (error) {
    console.error("admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch platform stats" });
  }
});
router9.get("/tenants", async (_req, res) => {
  try {
    const list = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      category: tenants.category,
      isListed: tenants.isListed,
      isSuspended: tenants.isSuspended,
      createdAt: tenants.createdAt,
      planId: tenantSubscriptions.planId,
      planName: plans.name,
      subStatus: tenantSubscriptions.status,
      trialEndsAt: tenantSubscriptions.trialEndsAt,
      endsAt: tenantSubscriptions.endsAt
    }).from(tenants).leftJoin(tenantSubscriptions, (0, import_drizzle_orm10.eq)(tenantSubscriptions.tenantId, tenants.id)).leftJoin(plans, (0, import_drizzle_orm10.eq)(plans.id, tenantSubscriptions.planId)).orderBy((0, import_drizzle_orm10.desc)(tenants.createdAt)).all();
    res.json(list);
  } catch (error) {
    console.error("admin tenants error:", error);
    res.status(500).json({ error: "Failed to fetch tenants" });
  }
});
router9.put("/tenants/:id/suspend", async (req, res) => {
  const id = String(req.params.id || "");
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended }).from(tenants).where((0, import_drizzle_orm10.eq)(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: "Tenant not found" });
    if (existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: true, already: true });
    }
    await db.update(tenants).set({ isSuspended: true }).where((0, import_drizzle_orm10.eq)(tenants.id, id));
    res.json({ success: true, id, isSuspended: true });
  } catch (error) {
    console.error("admin suspend error:", error);
    res.status(500).json({ error: "Failed to suspend tenant" });
  }
});
router9.put("/tenants/:id/reactivate", async (req, res) => {
  const id = String(req.params.id || "");
  try {
    const existing = await db.select({ id: tenants.id, isSuspended: tenants.isSuspended }).from(tenants).where((0, import_drizzle_orm10.eq)(tenants.id, id)).get();
    if (!existing) return res.status(404).json({ error: "Tenant not found" });
    if (!existing.isSuspended) {
      return res.json({ success: true, id, isSuspended: false, already: true });
    }
    await db.update(tenants).set({ isSuspended: false }).where((0, import_drizzle_orm10.eq)(tenants.id, id));
    res.json({ success: true, id, isSuspended: false });
  } catch (error) {
    console.error("admin reactivate error:", error);
    res.status(500).json({ error: "Failed to reactivate tenant" });
  }
});
var admin_default = router9;

// src/api/health.ts
var import_express10 = require("express");
var import_drizzle_orm11 = require("drizzle-orm");
var router10 = (0, import_express10.Router)();
router10.get("/", async (_req, res) => {
  try {
    await db.run(import_drizzle_orm11.sql`SELECT 1`);
    res.status(200).json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});
var health_default = router10;

// src/api/index.ts
var router11 = (0, import_express11.Router)();
router11.use("/auth", auth_default);
router11.use("/tenant", tenant_default);
router11.use("/tenant", pro_site_default);
router11.use("/tenant", site_settings_default);
router11.use("/bookings", bookings_default);
router11.use("/public", public_default);
router11.use("/payments", payments_default);
router11.use("/admin", admin_default);
router11.use("/health", health_default);
if (process.env.ENABLE_TEST_ENDPOINTS === "true") {
  router11.use("/test", test_default);
}
router11.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});
var api_default = router11;

// src/db/migrations.ts
var import_drizzle_orm12 = require("drizzle-orm");
var import_crypto7 = __toESM(require("crypto"), 1);
async function getColumns(tableName) {
  const driver = db.session?.client ?? db.$client ?? db.driver;
  const client2 = driver ?? db;
  const result = await (client2.execute ? client2.execute(`PRAGMA table_info(${tableName})`) : db.all({ sql: `PRAGMA table_info(${tableName})` }));
  const rows = result?.rows ?? result;
  return new Set(rows.map((r) => r.name));
}
async function addColumnIfMissing(table, column, sql5) {
  const cols = await getColumns(table);
  if (cols.has(column)) return null;
  const driver = db.session?.client ?? db.$client ?? db.driver;
  const client2 = driver ?? db;
  if (client2.execute) {
    await client2.execute(sql5);
  } else {
    await db.run({ sql: sql5 });
  }
  return column;
}
async function ensureSchemaMigrations() {
  const added = {};
  const migrations = [
    // `site_config` — the Website Builder's mode + published Code-Mode HTML.
    // Declared in schema.ts but historically never created by any migration,
    // which made the whole Code Mode editor 500 ("no such table"). CREATE
    // TABLE IF NOT EXISTS is a no-op once it exists.
    {
      table: "site_config",
      column: "id",
      sql: `
        CREATE TABLE IF NOT EXISTS site_config (
          tenant_id TEXT PRIMARY KEY REFERENCES tenants(id),
          builder_mode TEXT NOT NULL DEFAULT 'puck',
          published_code_html TEXT,
          updated_at INTEGER NOT NULL
        )
      `
    },
    // `isSuspended` was added after launch. Default false so existing tenants
    // continue to serve; the admin route is the only writer.
    {
      table: "tenants",
      column: "is_suspended",
      sql: `ALTER TABLE tenants ADD COLUMN is_suspended INTEGER NOT NULL DEFAULT 0`
    },
    {
      // Idempotency log for inbound payment webhooks. The (provider, event_id)
      // unique index is what makes "duplicate webhook replay" a race-free
      // detection — the second concurrent insert hits UNIQUE and we
      // short-circuit without mutating payment/appointment rows.
      //
      // CREATE TABLE is wrapped in `IF NOT EXISTS` because the Drizzle schema
      // bootstrap (from schema.ts) will also create it on a fresh DB; we only
      // want this migration to guarantee the table exists for databases that
      // already have everything except this new row.
      table: "processed_webhook_events",
      column: "id",
      sql: `
        CREATE TABLE IF NOT EXISTS processed_webhook_events (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          event_id TEXT NOT NULL,
          tx_ref TEXT,
          payment_id TEXT,
          action TEXT NOT NULL,
          raw TEXT,
          received_at INTEGER NOT NULL
        )
      `
    },
    {
      // Same rationale as above: the unique index is part of declarative
      // schema (schema.ts) on fresh installs; CREATE UNIQUE INDEX IF NOT
      // EXISTS covers existing installs that gained the table via the prior
      // step but don't yet have the index.
      table: "processed_webhook_events",
      column: "idx_provider_event",
      sql: `CREATE UNIQUE INDEX IF NOT EXISTS processed_webhook_events_provider_event_unique ON processed_webhook_events(provider, event_id)`
    },
    {
      // security_events — append-only audit log for security-relevant
      // occurrences (failed logins, rejected webhook signatures, rate
      // limit triggers, cross-tenant access attempts). Created here so
      // existing installs gain the table on the next boot without having
      // to wipe sqlite.db; fresh installs get it from schema.ts.
      table: "security_events",
      column: "id",
      sql: `
        CREATE TABLE IF NOT EXISTS security_events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          tenant_id TEXT,
          ip TEXT,
          result TEXT NOT NULL,
          details TEXT,
          created_at INTEGER NOT NULL
        )
      `
    },
    {
      // Supporting indexes for the (future) admin dashboard views:
      //   - list events of a given type over time.
      //   - list events scoped to a tenant, ordered newest-first.
      table: "security_events",
      column: "idx_event_type",
      sql: `CREATE INDEX IF NOT EXISTS security_events_event_type_idx ON security_events(event_type)`
    },
    {
      table: "security_events",
      column: "idx_tenant_created",
      sql: `CREATE INDEX IF NOT EXISTS security_events_tenant_created_idx ON security_events(tenant_id, created_at)`
    },
    {
      table: "users",
      column: "token_version",
      sql: `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`
    },
    {
      // consent_given_at — records when the user agreed to Privacy Policy + Terms.
      // Nullable so existing users aren't blocked; new registrations must provide it.
      table: "users",
      column: "consent_given_at",
      sql: `ALTER TABLE users ADD COLUMN consent_given_at INTEGER`
    },
    {
      // is_superadmin — platform-level admin flag for the internal /admin panel.
      // Only ever set manually in the DB for the operator's own account, never
      // via signup. Default false so every existing user stays non-admin.
      table: "users",
      column: "is_superadmin",
      sql: `ALTER TABLE users ADD COLUMN is_superadmin INTEGER NOT NULL DEFAULT 0`
    }
  ];
  for (const m of migrations) {
    try {
      const addedCol = await addColumnIfMissing(m.table, m.column, m.sql);
      if (addedCol) {
        (added[m.table] ||= []).push(addedCol);
      }
    } catch (err) {
      console.warn(`[migrations] ${m.table}.${m.column} skipped:`, err?.message);
    }
  }
  await normalizePlanRows();
  return added;
}
async function normalizePlanRows() {
  try {
    const all = await db.select().from(plans).all();
    const canonicalFree = all.find((p) => p.name === "free");
    const canonicalPro = all.find((p) => p.name === "pro");
    const legacyFree = all.find((p) => p.name === "Basic");
    const legacyPro = all.find((p) => p.name === "Pro");
    const freeId = canonicalFree?.id;
    const proId = canonicalPro?.id;
    if (!freeId) {
      const row = { id: import_crypto7.default.randomUUID(), name: "free", price: 0, maxStaff: 2, customDomainAllowed: false };
      await db.insert(plans).values(row);
      const created = await db.select().from(plans).where((0, import_drizzle_orm12.eq)(plans.name, "free")).get();
      if (created && legacyFree) {
        await db.update(tenantSubscriptions).set({ planId: created.id }).where((0, import_drizzle_orm12.eq)(tenantSubscriptions.planId, legacyFree.id));
        await db.delete(plans).where((0, import_drizzle_orm12.eq)(plans.id, legacyFree.id)).catch(() => {
        });
      }
    } else if (legacyFree) {
      await db.update(tenantSubscriptions).set({ planId: freeId }).where((0, import_drizzle_orm12.eq)(tenantSubscriptions.planId, legacyFree.id));
      await db.delete(plans).where((0, import_drizzle_orm12.eq)(plans.id, legacyFree.id)).catch(() => {
      });
    }
    if (!proId) {
      const row = { id: import_crypto7.default.randomUUID(), name: "pro", price: 1e5, maxStaff: 10, customDomainAllowed: true };
      await db.insert(plans).values(row);
      const created = await db.select().from(plans).where((0, import_drizzle_orm12.eq)(plans.name, "pro")).get();
      if (created && legacyPro) {
        await db.update(tenantSubscriptions).set({ planId: created.id }).where((0, import_drizzle_orm12.eq)(tenantSubscriptions.planId, legacyPro.id));
        await db.delete(plans).where((0, import_drizzle_orm12.eq)(plans.id, legacyPro.id)).catch(() => {
        });
      }
    } else if (legacyPro) {
      await db.update(tenantSubscriptions).set({ planId: proId }).where((0, import_drizzle_orm12.eq)(tenantSubscriptions.planId, legacyPro.id));
      await db.delete(plans).where((0, import_drizzle_orm12.eq)(plans.id, legacyPro.id)).catch(() => {
      });
    }
  } catch (err) {
    console.warn("[migrations] normalizePlanRows skipped:", err?.message);
  }
}

// src/lib/envGuards.ts
var checks = [
  {
    name: "CHAPA_SECRET_KEY",
    read: () => process.env.CHAPA_SECRET_KEY?.trim() || null,
    rejectIfEquals: ["CHASECK_TEST-g3pDAuHMdioBphvmSN0ETveYu5KPaDD5"],
    prodOnly: true
  },
  {
    name: "CHAPA_WEBHOOK_SECRET",
    read: () => process.env.CHAPA_WEBHOOK_SECRET?.trim() || null,
    rejectIfEquals: ["CyNDCzoXF7JsaPig6GErkdT0"],
    prodOnly: true
  },
  {
    name: "APP_URL",
    read: () => process.env.APP_URL?.trim() || null,
    prodOnly: true
  },
  {
    name: "JWT_SECRET",
    // Already FATAL-checked in the route modules; this is a second line of
    // defense that catches the "module not yet loaded" case.
    read: () => process.env.JWT_SECRET?.trim() || null,
    rejectIfEquals: ["supersecret_fallback", "test-jwt-secret-"],
    prodOnly: true
  },
  {
    name: "REFRESH_SECRET",
    read: () => process.env.REFRESH_SECRET?.trim() || null,
    rejectIfEquals: ["supersecret_fallback", "test-refresh-secret-"],
    prodOnly: true
  }
];
function validateProductionEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const failures = [];
  for (const c of checks) {
    if (c.prodOnly && !isProd) continue;
    const value = c.read();
    if (!value) {
      failures.push(`${c.name} is not set`);
      continue;
    }
    if (c.rejectIfEquals && c.rejectIfEquals.includes(value)) {
      failures.push(`${c.name} is set to a known-insecure default (rotate it)`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `[env] Production boot aborted. Fix the following:
  - ${failures.join("\n  - ")}`
    );
  }
}

// server.ts
var app = (0, import_express12.default)();
var PORT = 3e3;
app.use((0, import_helmet.default)({ contentSecurityPolicy: false }));
var allowedOrigin = (origin) => {
  if (!origin) return true;
  let host2;
  try {
    host2 = new URL(origin).hostname;
  } catch {
    return false;
  }
  return host2 === "localhost" || host2 === "127.0.0.1" || host2 === "egebeya.et" || host2.endsWith(".egebeya.et") || host2.endsWith(".run.app");
};
app.use((0, import_cors.default)({ origin: allowedOrigin }));
app.use(import_express12.default.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use("/api", api_default);
var BLOCKED_FILE = /\.(env|db|sqlite|sqlite3|log|lock|cjs)$/i;
var BLOCKED_PATHS = /^\/(\.git|\.env|sqlite\.db|server\.ts|server\.cjs|tsconfig\.json|package\.json|package-lock\.json|bun\.lock|drizzle\.config\.ts|metadata\.json|_secrets_audit\.mjs|_check_tables\.)/i;
app.use((req, res, next) => {
  if (BLOCKED_FILE.test(req.path) || BLOCKED_PATHS.test(req.path)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});
app.use((err, _req, res, _next) => {
  if (err instanceof import_multer2.default.MulterError || err?.message === "Invalid file type" || err?.message === "Only images are allowed") {
    return res.status(400).json({ error: "Invalid upload. Please upload a valid image file." });
  }
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }
  console.error("[error]", err);
  res.status(500).json({ error: "An internal server error occurred." });
});
async function startServer() {
  if (process.env.NODE_ENV === "production") {
    validateProductionEnv();
  }
  try {
    const added = await ensureSchemaMigrations();
    if (Object.keys(added).length > 0) {
      console.log("[migrations] applied:", JSON.stringify(added));
    }
  } catch (migrateErr) {
    console.error("[migrations] failed:", migrateErr);
  }
  const uploadsPath = import_path3.default.join(process.cwd(), "dist", "uploads");
  app.use("/uploads", import_express12.default.static(uploadsPath));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist");
    app.use("/uploads", import_express12.default.static(import_path3.default.join(distPath, "uploads")));
    app.use(import_express12.default.static(distPath));
    app.get("*splat", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
