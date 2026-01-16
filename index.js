import express from "express";
import { sequelize } from "./db.js";
import { Account } from "./models/Account.js";
import optimisticRoutes from "./routes/optimistic.js";
import pessimisticRoutes from "./routes/pessimistic.js";

const app = express();
app.use(express.json());

app.use("/optimistic", optimisticRoutes);
app.use("/pessimistic", pessimisticRoutes);

await sequelize.sync({ force: true });

// Seed account
await Account.create({ balance: 100 });

app.listen(3000, () => {
  console.log("API running on http://localhost:3000");
});
