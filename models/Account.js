import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

export const Account = sequelize.define(
  "Account",
  {
    balance: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    version: true // 👈 Enables optimistic locking
  }
);
