import mongoose from "mongoose";

const isPlainObject = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export const isDateOnly = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export function getDateOnlyInTimeZone(timeZone = process.env.APP_TIME_ZONE || "Asia/Kolkata") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Small reusable request-body validator. Rules are intentionally explicit so
 * route requirements remain easy for a beginner to understand and maintain.
 */
export function validateBody(schema, { allowUnknown = false, requireAtLeastOne = false } = {}) {
  return (req, res, next) => {
    if (!isPlainObject(req.body)) {
      return res.status(400).json({ message: "Request body must be a JSON object." });
    }

    const entries = Object.entries(req.body);
    if (requireAtLeastOne && entries.length === 0) {
      return res.status(400).json({ message: "Provide at least one field to update." });
    }

    for (const [key, value] of entries) {
      const rule = schema[key];
      if (!rule) {
        if (!allowUnknown) return res.status(400).json({ message: `Unknown field: ${key}.` });
        continue;
      }
      if (value === undefined) continue;
      if (value === null && rule.nullable) continue;

      if (rule.type === "string") {
        if (typeof value !== "string") {
          return res.status(400).json({ message: `${rule.label || key} must be a string.` });
        }
        const normalized = rule.trim === false ? value : value.trim();
        if (rule.required && !normalized) {
          return res.status(400).json({ message: `${rule.label || key} is required.` });
        }
        if (rule.minLength !== undefined && normalized.length < rule.minLength) {
          return res.status(400).json({ message: `${rule.label || key} must be at least ${rule.minLength} characters.` });
        }
        if (rule.maxLength !== undefined && normalized.length > rule.maxLength) {
          return res.status(400).json({ message: `${rule.label || key} must be ${rule.maxLength} characters or fewer.` });
        }
        if (rule.maxBytes !== undefined && Buffer.byteLength(normalized, "utf8") > rule.maxBytes) {
          return res.status(400).json({ message: `${rule.label || key} must be ${rule.maxBytes} bytes or fewer.` });
        }
        if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          return res.status(400).json({ message: "Enter a valid email address." });
        }
        if (rule.dateOnly && normalized !== "" && !isDateOnly(normalized)) {
          return res.status(400).json({ message: `${rule.label || key} must be a valid date in YYYY-MM-DD format.` });
        }
        if (rule.enum && !rule.enum.includes(normalized)) {
          return res.status(400).json({ message: `${rule.label || key} must be one of: ${rule.enum.join(", ")}.` });
        }
      } else if (rule.type === "objectId") {
        if (value === "" && rule.allowEmpty) continue;
        if (typeof value !== "string" || !mongoose.isValidObjectId(value)) {
          return res.status(400).json({ message: `${rule.label || key} is invalid.` });
        }
      } else if (rule.type === "boolean" && typeof value !== "boolean") {
        return res.status(400).json({ message: `${rule.label || key} must be a boolean.` });
      }
    }

    for (const [key, rule] of Object.entries(schema)) {
      if (rule.required && !(key in req.body)) {
        return res.status(400).json({ message: `${rule.label || key} is required.` });
      }
    }

    return next();
  };
}

export function validateParams(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      if (!mongoose.isValidObjectId(req.params[name])) {
        return res.status(400).json({ message: `Invalid ${name}.` });
      }
    }
    next();
  };
}
