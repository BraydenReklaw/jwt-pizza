import { Page } from "@playwright/test";
import { test, expect } from "playwright-test-coverage";
import { User, Role } from "../src/service/pizzaService";

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    "d@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "d@jwt.com",
      password: "a",
      roles: [{ role: Role.Diner }],
    },
    "f@jwt.com": {
      id: "4",
      name: "Fran Chise",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role: Role.Franchisee, objectId: "2" }],
    },
    "a@jwt.com": {
      id: "5",
      name: "Ad Min",
      email: "a@jwt.com",
      password: "a",
      roles: [{ role: Role.Admin }],
    },
  };

  // Authorize login for the given user
  await page.route("*/**/api/auth", async (route) => {
    const method = route.request().method();

    if (method === "DELETE") {
      // Handle logout
      loggedInUser = undefined;
      await route.fulfill({ json: { message: "Logged out" } });
      return;
    }
    if (method === "PUT") {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];
      if (!user || user.password !== loginReq.password) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      loggedInUser = validUsers[loginReq.email];
      const loginRes = {
        user: loggedInUser,
        token: "abcdef",
      };
      expect(route.request().method()).toBe("PUT");
      await route.fulfill({ json: loginRes });
    }
    if (method === "POST") {
      const { name, email, password } = route.request().postDataJSON();
      if (validUsers[email]) {
        await route.fulfill({
          status: 409,
          json: { error: "User already exists" },
        });
        return;
      }
      const newUser: User = {
        id: String(Object.keys(validUsers).length + 3),
        name,
        email,
        password,
        roles: [{ role: Role.Diner }],
      };
      validUsers[email] = newUser;
      loggedInUser = newUser;
      await route.fulfill({ json: { user: newUser, token: "ghijkl" } });
    }
  });

  // Return the currently logged in user
  await page.route("*/**/api/user/me", async (route) => {
    const method = route.request().method();

    if (method === "GET") {
      await route.fulfill({ json: loggedInUser });
      return;
    }

    if (method === "PUT") {
      if (!loggedInUser) {
        await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
        return;
      }
      const updatedData = route.request().postDataJSON();
      loggedInUser = { ...loggedInUser, ...updatedData };
      // Update also in validUsers so login reflects changes
      validUsers[loggedInUser.email] = loggedInUser;

      await route.fulfill({ json: loggedInUser });
      return;
    }
  });
}

test("updateUser", async ({ page }) => {
  basicInit(page);
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();

  await page.getByRole("link", { name: "pd" }).click();
  // change name
  await expect(page.getByRole("main")).toContainText("pizza diner");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza dinerx");
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
  //check change persistent
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();

  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
});

test("change password", async ({ page }) => {
  basicInit(page);
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto("/");
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByRole("textbox", { name: "Full name" }).fill("pizza diner");
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
  await page.getByRole("button", { name: "Register" }).click();
  // change password
  await page.getByRole("link", { name: "pd" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("dinerx");
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  // test new password
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("diner");
});
