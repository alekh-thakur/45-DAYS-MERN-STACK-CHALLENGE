const { isEmail } =  require("../src/utils.js");

test("isEmail works", () => {
  expect(isEmail("test@example.com")).toBe(true);
  expect(isEmail("invalid")).toBe(false);
});
