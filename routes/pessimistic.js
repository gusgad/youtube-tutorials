import express from "express";
import { sequelize } from "../db.js";
import { Account } from "../models/Account.js";

const router = express.Router();

router.post("/withdraw", async (req, res) => {
  const { amount } = req.body;

  const transaction = await sequelize.transaction();

  try {
    const account = await Account.findOne({
      where: { id: 1 },
      lock: transaction.LOCK.UPDATE, // 👈 PESSIMISTIC LOCK
      transaction
    });

    if (account.balance < amount) {
      throw new Error("Insufficient funds");
    }

    account.balance -= amount;
    await account.save({ transaction });

    await transaction.commit();
    res.json({ balance: account.balance });
  } catch (err) {
    await transaction.rollback();
    res.status(400).json({ error: err.message });
  }
});

export default router;
