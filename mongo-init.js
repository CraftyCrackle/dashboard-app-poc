db = db.getSiblingDB("hospital_dashboard");

// Create application user
db.createUser({
  user: "app_user",
  pwd: process.env.MONGO_APP_PASSWORD || "change_this_password",
  roles: [{ role: "readWrite", db: "hospital_dashboard" }],
});

// Create collections with indexes
db.createCollection("users");
db.users.createIndex({ email: 1 }, { unique: true });

db.createCollection("dashboards");
db.dashboards.createIndex({ organization: 1, name: 1 }, { unique: true });

db.createCollection("data_sources");
db.data_sources.createIndex({ name: 1 }, { unique: true });

db.createCollection("api_keys");
db.api_keys.createIndex({ key: 1 }, { unique: true });

db.createCollection("audit_log");
db.audit_log.createIndex({ timestamp: 1 });
db.audit_log.createIndex({ user_id: 1 });

// Create default admin user if not exists
db.users.updateOne(
  { email: "admin@hospital.com" },
  {
    $setOnInsert: {
      email: "admin@hospital.com",
      password: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFpxYLHS.bXqhl6", // admin123
      name: "Admin User",
      organization: "Hospital",
      role: "admin",
      created_at: new Date(),
    },
  },
  { upsert: true }
);
