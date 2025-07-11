import { hash, spawn } from "bun";
import { describe, test, beforeAll, afterAll, expect, beforeEach, afterEach } from "bun:test";
import { rm, cp } from "fs/promises";
import { Database } from "bun:sqlite";

type Response = {
    [props: string]: any
}

let server: Bun.Subprocess;
const DB_PATH = "./inventory.db";
const BASE_URL = "http://localhost:3000";
const DB_SNAPSHOTS = {
    empty: './fixtures/empty.db',
    with_items: './fixtures/populated.db'
}

const startServer = async (cleanDb = true, preload = false) => {
    if (cleanDb) await rm(DB_PATH, {force: true});
    if (preload) await cp(DB_SNAPSHOTS.with_items, './inventory.db')
    server = spawn(["./inventory-manager"]);
    await waitForServer();
}

const stopServer = async () => {
    server.kill()
    await rm(DB_PATH, {force: true});
}

async function waitForServer() {
    let attempts = 0;
    while (attempts < 10) {
        try {
            const response = await fetch(BASE_URL);
            if (response.ok) return;
        } catch (e) {
            attempts++;
            await new Promise(r => setTimeout(r, 500));
        }
    }
    throw new Error("Server did not start in time");
}

const createItem = async (name: string, initial_stock: number) => {
    return fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name, initial_stock})});
}

const queryDb = async (sql: string, params: any[] = []) => {
    const db = new Database("./inventory.db");
    const statement = db.prepare(sql);
    const result = await statement.all(...params);
    db.close();
    return result;
}

async function getDatabaseSnapshot() {
  const file = Bun.file("./inventory.db");
  const buffer = await file.arrayBuffer();
  const fileHash = hash(new Uint8Array(buffer));
  
  return {
    size: buffer.byteLength,
    hash: fileHash
  };
}

describe("Inventory Management System - Happy path tests, Invalid inputs and startup/stop server", () => {
    beforeAll(async () => {
        await startServer(true);
    });

    afterAll(async () => {
        await stopServer();
    });

    test("Should GET / with correct status", async () => {
        const response = await fetch(BASE_URL);
        expect(await response.text()).toBe("it just werks");
    });

    test("Should create an item in a blank database", async () => {
        const item = {
            name: "Item1",
	        initial_stock: 500
        }
        const response = await createItem(item.name, item.initial_stock);
        const result: Response = await response.json() as Response;
        expect(result?.id).toBe(1);
    });

    test("Should create and retrieve an item", async () => {
        const item = {
            name: "Item2",
	        initial_stock: 10
        }

        const creation = await createItem(item.name, item.initial_stock);
        const creationObj = await creation.json() as Response;
        const response = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "GET", mode: "cors", headers: {"Content-Type": "application/json"}});
        const result = await response.json() as Response;

        expect(result.name).toBe(item.name);
        expect(result.id).toBe(creationObj.id);
    });

    test("Should create an item and adjust it's stock", async () => {
        const item = {
            name: "Item2",
	        initial_stock: 10
        }
        const adjust = {
            stock_delta: 5,
            reason: 'New buyings'
        }
        
        const creation = await createItem(item.name, item.initial_stock);
        const creationObj = await creation.json() as Response;
        const response = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust)});
        const result = await response.json() as Response;
        expect(creationObj.name).toBe(item.name);
        expect(result.stock).toBe(item.initial_stock+adjust.stock_delta);
    });

    test("Should test creation of items with same name", async () => {
        const item = {
            name: "Item2",
	        initial_stock: 10
        }
        const item1 = {
            name: "Item2",
	        initial_stock: 20
        }
        
        const creation = await createItem(item.name, item.initial_stock);
        const creationObj = await creation.json() as Response;
        const creation1 = await createItem(item1.name, item1.initial_stock);
        const result = await creation1.json() as Response;
        expect(creationObj.name).toBe(item.name);
        expect(result.name).toBe(item1.name);
    });

    test("Should not create items without stock valid value", async () => {
        const item = {
            name: "Item",
	        initial_stock: null
        }
        const item1 = {
            name: "Item1",
	        initial_stock: undefined
        }
        const item2 = {
            name: "Item2",
	        initial_stock: "1"
        }
        const item3 = {
            name: "Item2",
	        initial_stock: 9999999999
        }
        const item4 = {
            name: "Item2",
	        initial_stock: -9999999999
        }
        
        const creation = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item)});
        expect(creation.status).toBe(422);
        expect(creation.statusText).toBe('Unprocessable Entity');
        expect(creation.ok).toBe(false);

        const creation1 = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item1)});
        expect(creation1.status).toBe(422);
        expect(creation1.statusText).toBe('Unprocessable Entity');
        expect(creation1.ok).toBe(false);

        const creation2 = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item2)});
        expect(creation2.status).toBe(422);
        expect(creation2.statusText).toBe('Unprocessable Entity');
        expect(creation2.ok).toBe(false);

        const creation3 = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item3)});
        expect(creation3.status).toBe(422);
        expect(creation3.statusText).toBe('Unprocessable Entity');
        expect(creation3.ok).toBe(false);

        const creation4 = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item4)});
        expect(creation4.status).toBe(422);
        expect(creation4.statusText).toBe('Unprocessable Entity');
        expect(creation4.ok).toBe(false);
    });

    test("Should not adjust item's stock with invalid values", async () => {
        const item = {
            name: "Item2",
	        initial_stock: 10
        }
        const adjust = {
            stock_delta: 5,
            reason: null
        }
        const adjust1 = {
            stock_delta: 5,
            reason: 1
        }
        const adjust2 = {
            stock_delta: 5,
            reason: true
        }
        const adjust3 = {
            stock_delta: 5,
            reason: true
        }
        const adjust4 = {
            stock_delta: 5,
            reason: [1, "test", true]
        }
        
        const creation = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item)});
        const creationObj = await creation.json() as Response;
        const response = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust)});
        const response1 = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust1)});
        const response2 = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust2)});
        const response3 = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust3)});
        const response4 = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust4)});

        expect(response.status).toBe(422);
        expect(response1.status).toBe(422);
        expect(response2.status).toBe(422);
        expect(response3.status).toBe(422);
        expect(response4.status).toBe(422);
        expect(response.statusText).toBe('Unprocessable Entity');
        expect(response1.statusText).toBe('Unprocessable Entity');
        expect(response2.statusText).toBe('Unprocessable Entity');
        expect(response3.statusText).toBe('Unprocessable Entity');
        expect(response4.statusText).toBe('Unprocessable Entity');
        expect(response.ok).toBe(false);
        expect(response1.ok).toBe(false);
        expect(response2.ok).toBe(false);
        expect(response3.ok).toBe(false);
        expect(response4.ok).toBe(false);
    });

    test("Should not create an item if there's any missing key", async () => {
        const item = {
            name: "Item1"
        }
        const item1 = {
            initial_stock: 10
        }

        const creation = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item)});
        const creation1 = await fetch(`${BASE_URL}/items`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(item1)});

        expect(creation.status).toBe(422);
        expect(creation1.status).toBe(422);
    });
    
    test("Should not decrease stock if there ins't enough stock", async () => {
        const item = {
            name: 'Item10',
            initial_stock: 10
        }

        const adjust = {
            stock_delta: 11,
            reason: 'New buyings'
        }
        
        const creation = await createItem(item.name, item.initial_stock);
        const creationObj = await creation.json() as Response;
        const response = await fetch(`${BASE_URL}/items/${creationObj.id}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust)});
        const result = await response.text();
        expect(result).toBe("not enough stock");
    });

    test("Should test concurrent api calls to adjust stock", async () => {
        const request = await createItem("Concurrency Test", 100)
        const creation = await request.json() as Response;
        
        const adjustments = Array.from({ length: 10 }, (_, i) => 
            fetch(`${BASE_URL}/items/${creation.id}`, {
                method: "POST",
                mode: "cors",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ stock_delta: -1 })
            })
        );

        const results = await Promise.all(adjustments);
        
        results.forEach(response => {
            expect(response.ok).toBe(true);
        });

        const final = await fetch(`${BASE_URL}/items/${creation.id}`);
        const item = await final.json() as Response;
        expect(item.stock).toBe(90);
    });

    test("Should test stock adjustment in race condition", async () => {
        const request = await createItem("Race Test", 10);
        const creation = await request.json() as Response;
        
        const [res1, res2] = await Promise.all([
            fetch(`${BASE_URL}/items/${creation.id}`, {
            method: 'POST',
            body: JSON.stringify({ stock_delta: -5 })
            }),
            fetch(`${BASE_URL}/items/${creation.id}`, {
                method: 'POST',
                body: JSON.stringify({ stock_delta: -6 })
            })
        ]);

        const successCount = [res1, res2].filter(r => r.ok).length;
        expect(successCount).toBeLessThan(2);
        
        const final = await fetch(`${BASE_URL}/items/${creation.id}`);
        const item = await final.json() as Response;
        expect(item.stock).toBeGreaterThanOrEqual(0);
    });

    test("Should test stock adjustment in sequential stress test with 100 requests", async () => {
        const request = await createItem("Stress Test", 1000);
        const creation = await request.json() as Response;
        const iterations = 100;
        
        for (let i = 0; i < iterations; i++) {
            const response = await fetch(`${BASE_URL}/items/${creation.id}`, {
                method: 'POST',
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ stock_delta: -1 })
            });
            expect(response.ok).toBe(true);
        }
        
        const final = await fetch(`${BASE_URL}/items/${creation.id}`);
        const item = await final.json() as Response;
        expect(item.stock).toBe(900);
    });

    /** Stress test that reveal improvement needs in adjustment post logic */
    test("Should test stock adjustment in sequential stress test with 1000 requests", async () => {
        const request = await createItem("Stress Test", 10000);
        const creation = await request.json() as Response;
        const iterations = 1000;
        
        for (let i = 0; i < iterations; i++) {
            const response = await fetch(`${BASE_URL}/items/${creation.id}`, {
                method: 'POST',
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ stock_delta: -1 })
            });
            expect(response.ok).toBe(true);
        }
        
        const final = await fetch(`${BASE_URL}/items/${creation.id}`);
        const item = await final.json() as Response;
        expect(item.stock).toBe(9000);
    });
});

describe("Inventory Management System - Using database snapshots", async () => {
    let initialSnapshot: Awaited<ReturnType<typeof getDatabaseSnapshot>>;

    beforeEach(async () => {
        await startServer(true);
        initialSnapshot = await getDatabaseSnapshot();
    });

    afterEach(() => {
        stopServer();
    });

    /** Preloaded database tested with two different approaches */
    /** First comparing pre-saved item result's from select item's set directly from database */
    test("Should preload a database snapshot, compare using SQL and pre-saved results", async () => {
        stopServer();
        await startServer(true, true);
        const result = await queryDb('select * from items');
        expect(result).toEqual([{
            "id": 1,
            "name": "NewItem1",
            "stock": 500
        },
        {
            "id": 2,
            "name": "NewItem2",
            "stock": 5
        },
        {
            "id": 3,
            "name": "NewItem45",
            "stock": 99
        }]);
    });

    /** Second comparing pre-saved item result's through snapshot size */
    test("Should preload a database snapshot, compare using snapshot size", async () => {
        stopServer();
        await startServer(true, true);
        let currentSnapshot = await getDatabaseSnapshot();
        expect(currentSnapshot.size).toBeGreaterThan(0);
    });

    test("Should adjust stock in a preloaded database snapshot", async () => {
        stopServer();
        await startServer(true, true);
        const adjust = {
            stock_delta: -5,
            reason: "selling product",
            itemId: 2
        };

        const response = await fetch(`${BASE_URL}/items/${adjust.itemId}`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify({stock_delta: adjust.stock_delta, reason: adjust.reason})});
        const result = await response.json() as Response;
        expect(result.stock).toEqual(0);
    });
    /** Test trying to retrieve item's information from an empty database, THIS ONE MADE THE SERVER TO GO IN PANIC */
    test("Should not retrieve item's information if database is empty", async () => {
        expect(await fetch(`${BASE_URL}/items/1`, {method: "GET", mode: "cors", headers: {"Content-Type": "application/json"}})).rejects.toThrowError();
    });

    test("Should not adjust stock in an empty database snapshot", async () => {
        stopServer();
        await startServer(true);
        const adjust = {
            stock_delta: -5,
            reason: "selling item"
        };

        const response = await fetch(`${BASE_URL}/items/1`, {method: "POST", mode: "cors", headers: {"Content-Type": "application/json"}, body: JSON.stringify(adjust)});
        expect(response.status).toEqual(500);
    });
    
    test("Database should match empty snapshot", async () => {
        stopServer();
        await startServer(true);
        const current = await getDatabaseSnapshot();
        expect(current.size).toBe(initialSnapshot.size);
    });
    
    test("Database snapshot hash should be different after any operation", async () => {
        stopServer();
        await startServer(true);
        initialSnapshot = await getDatabaseSnapshot();
        await createItem("Snapshot Item", 10);
        
        const current = await getDatabaseSnapshot();
        expect(current.hash).not.toBe(initialSnapshot.hash);
    });
});