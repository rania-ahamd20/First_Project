const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "expense_tracker",
});

const ALLOWED_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

const SELECT_EXPENSES_SQL = `
  SELECT 
    id, 
    title, 
    amount::float8 AS amount, 
    category, 
    to_char(date, 'YYYY-MM-DD') AS date 
  FROM expenses
`;

const isValidId = (id) => !isNaN(id) && Number.isInteger(Number(id)) && Number(id) > 0;

const validateExpenseData = ({ title, amount, category, date }) => {
  if (!title || typeof title !== "string" || title.trim() === "") {
    return "Title is required and must be a non-empty string.";
  }
  
  const numericAmount = Number(amount);
  if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount <= 0) {
    return "Amount is required and must be a number greater than 0.";
  }

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return `Category must be one of the following: ${ALLOWED_CATEGORIES.join(", ")}`;
  }

  if (!date || isNaN(Date.parse(date))) {
    return "Date is required and must be a valid date format (YYYY-MM-DD).";
  }

  return null;
};

app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(`${SELECT_EXPENSES_SQL} ORDER BY date DESC, id DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ error: "Expense not found." });
  }

  try {
    const result = await pool.query(`${SELECT_EXPENSES_SQL} WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching expense:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/expenses", async (req, res) => {
  const { title, amount, category, date } = req.body;

  const validationError = validateExpenseData({ title, amount, category, date });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const queryText = `
      INSERT INTO expenses (title, amount, category, date)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, amount::float8 AS amount, category, to_char(date, 'YYYY-MM-DD') AS date
    `;
    const values = [title.trim(), Number(amount), category, date];
    const result = await pool.query(queryText, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating expense:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;
  const { title, amount, category, date } = req.body;

  if (!isValidId(id)) {
    return res.status(404).json({ error: "Expense not found." });
  }

  const validationError = validateExpenseData({ title, amount, category, date });
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  try {
    const queryText = `
      UPDATE expenses
      SET title = $1, amount = $2, category = $3, date = $4
      WHERE id = $5
      RETURNING id, title, amount::float8 AS amount, category, to_char(date, 'YYYY-MM-DD') AS date
    `;
    const values = [title.trim(), Number(amount), category, date, id];
    const result = await pool.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating expense:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ error: "Expense not found." });
  }

  try {
    const result = await pool.query("DELETE FROM expenses WHERE id = $1 RETURNING id", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Expense not found." });
    }

    res.json({ message: "Expense deleted successfully.", id: Number(id) });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});