# Inventory Management Integration Testing

Your assignment is to write integration tests using [`bun`](https://bun.sh) for a simple inventory management back-end. This is a **black-box testing** scenario — you are provided with a binary that runs on **Debian 12** and **Ubuntu 24.04**. Since most of our back-end services are written in Rust and target Debian-based Linux distributions, you are expected to be able to run such services locally.

### Server Behavior

- On startup, the application binds to `127.0.0.1:3000`.
- It will create a SQLite database file called `inventory.db` in the current working directory if one does not already exist.

### HTTP Endpoints

- `GET /`  
  Returns a plain text `"it just werks"` message. Use this to verify connectivity.

- `POST /items`  
  Creates a new inventory item with JSON payload:
  ```json
  { "name": "Widget", "initial_stock": 10 }
  ```
  The response body will contain the full item object, including its generated ID.

- `GET /items/{id}`  
  Fetches the current state of the item with the given ID.

- `POST /items/{id}`  
  Adjusts the stock level of an existing item.  
  JSON payload:
  ```json
  { "stock_delta": -3, "reason": "shrinkage" }
  ```
  The `reason` field is optional.

---

### Requirements

- Write tests that are able to detect **potential bugs** in the implementation.
- Include tests that start from a **clean database** (`inventory.db` does not exist).
- Include tests that start from a **known snapshot database** state.
- Include tests that **compare resulting `inventory.db`** against expected snapshots.
- Your tests should manage the **lifecycle of the application**, including launching and terminating the binary.

You are free to use any tools or libraries in the Bun/npm ecosystem, as long as your tests can run on Linux and can be executed with a single command.

Let us know if you run into any system-level issues getting the binary to run. Good luck!
