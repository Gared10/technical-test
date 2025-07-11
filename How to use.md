## Runing the tests

To run the tests, you just need to have the init setup for Bun to run tests(`bun init` would solve this problem), with `bun test --runInBand` command.

## More about Test Scenarios

Following the [Readme.md](./README.md), I've decided to separate automated tests in to suites:

- Inventory Management System - Happy path tests, Invalid inputs and startup/stop server
- Inventory Management System - Using database snapshots

The first one groups the tests that focus on happy paths, invalid inputs, start and stop server, and some race/stress tests. I've decided to have just two stress tests to demonstrate the need of improvement in adjustment logic, and other checks(I'm assuming that the logic is similar for the endpoint `GET /item`), in the case of stress test I wrote just two scenarios with two different sets of iterations, 100 and 1000, in the first case the test go through and passed, but in the second the server just stopped to respond. Since, the server failed with just 1000 requests, I've decided not to write more load tests, including the possibility of having more robust tools, like Artillery or k6 to achive a more robust load test suite.

The second suite, groups snapshot testing, comparing results through SQL query and through snapshot data size. I want to feature a test case that will fail too(similar to the previos stress test that I've mentioned), this one try to retrive data in an empty database snapshot for the `GET /item` endpoint, in this case the server go in panic, revealing the necessity of some reactive approach from the backend to avoid this type of error, since the server just refuse any requests to follow.
