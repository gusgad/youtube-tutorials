import express from "express";
import { Account } from "../models/Account.js";

const router = express.Router();

router.post("/withdraw", async (req, res) => {
  const { amount } = req.body;

  try {
    const account = await Account.findByPk(1);

    if (account.balance < amount) {
      throw new Error("Insufficient funds");
    }

    account.balance -= amount;
    await account.save(); // 👈 VERSION CHECK HERE

    res.json({ balance: account.balance });
  } catch (err) {
    res.status(409).json({
      error: "Concurrency conflict",
      details: err.message
    });
  }
});

export default router;
