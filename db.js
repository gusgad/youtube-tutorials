import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  "concurrency_demo",
  "postgres",
  "postgres",
  {
    host: "db",
    dialect: "postgres",
    logging: false
  }
);
