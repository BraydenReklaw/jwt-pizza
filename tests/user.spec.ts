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
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  // Mock for GET /api/user with pagination and name filter
  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe("GET");

    const url = new URL(route.request().url());
    const pageParam = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const nameFilterRaw = url.searchParams.get("name") || "*";
    const nameFilter = nameFilterRaw.replace(/\*/g, "").trim().toLowerCase();

    const allUsers = Object.values(validUsers).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles,
    }));

    // Apply name filter (case-insensitive substring match)
    const filteredUsers =
      nameFilter === "*" || nameFilter === ""
        ? allUsers
        : allUsers.filter((u) => u.name!.toLowerCase().includes(nameFilter));

    // Pagination
    const start = (pageParam - 1) * limit;
    const paginatedUsers = filteredUsers.slice(start, start + limit);

    const more = start + limit < filteredUsers.length;

    await route.fulfill({
      json: {
        users: paginatedUsers,
        more,
      },
    });
  });

  // Update user info
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    const method = route.request().method();
    const url = new URL(route.request().url());
    const userId = url.pathname.split("/").pop();

    if (method !== "PUT") {
      // assumes DELETE
      // Find user by ID
      const userEntry = Object.entries(validUsers).find(
        ([_, u]) => u.id === userId
      );
      if (!userEntry) {
        await route.fulfill({
          status: 404,
          json: { error: "User not found" },
        });
        return;
      }

      // Delete user
      const [email] = userEntry;
      delete validUsers[email];

      await route.fulfill({
        status: 204, // No Content
        json: {}, // some fetch implementations expect json, so empty object is fine
      });
      return;
    }

    if (!loggedInUser) {
      await route.fulfill({
        status: 401,
        json: { error: "Unauthorized" },
      });
      return;
    }

    
    const updateData = route.request().postDataJSON();

    // Find the user by ID
    const user = Object.values(validUsers).find((u) => u.id === userId);
    if (!user) {
      await route.fulfill({
        status: 404,
        json: { error: "User not found" },
      });
      return;
    }

    // Apply updates (name, email, password)
    const oldEmail = user.email;
    if (updateData.name) user.name = updateData.name;
    if (updateData.email) user.email = updateData.email;
    if (updateData.password) user.password = updateData.password;

    // If the email was changed, update the validUsers map key
    if (updateData.email && oldEmail !== updateData.email) {
      delete validUsers[oldEmail!];
      validUsers[updateData.email] = user;
    }

    // If the logged in user updated themselves, sync it
    if (loggedInUser.id === userId) {
      loggedInUser = user;
    }

    const response = {
      user,
      token: "updated-token-123",
    };

    await route.fulfill({ json: response });
  });

  // A standard menu
  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
      {
        id: 1,
        title: "Veggie",
        image: "pizza1.png",
        price: 0.0038,
        description: "A garden of delight",
      },
      {
        id: 2,
        title: "Pepperoni",
        image: "pizza2.png",
        price: 0.0042,
        description: "Spicy treat",
      },
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe("GET");

    const url = new URL(route.request().url());
    const nameFilterRaw = url.searchParams.get("name") || "*";

    const nameFilter = nameFilterRaw.replace(/\*/g, "").trim().toLowerCase();

    const allFranchises = [
      {
        id: 2,
        name: "LotaPizza",
        stores: [
          { id: 4, name: "Lehi" },
          { id: 5, name: "Springville" },
          { id: 6, name: "American Fork" },
        ],
      },
      { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
      { id: 4, name: "topSpot", stores: [] },
    ];

    // Apply name filter (case-insensitive substring match)
    const filteredFranchises =
      nameFilter === "*" || nameFilter.trim() === ""
        ? allFranchises
        : allFranchises.filter((f) =>
            f.name.toLowerCase().includes(nameFilter.toLowerCase())
          );

    const franchiseRes = { franchises: filteredFranchises };

    await route.fulfill({ json: franchiseRes });
  });

  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    if (loggedInUser?.roles?.find((r) => r.role === Role.Franchisee)) {
      await route.fulfill({
        json: [
          {
            id: 2,
            name: "LotaPizza",
            stores: [
              { id: 4, name: "Lehi", totalRevenue: 100 },
              { id: 5, name: "Springville", totalRevenue: 250 },
            ],
          },
        ],
      });
    } else {
      await route.fulfill({ json: [] });
    }
  });

  // Order a pizza.
  await page.route("*/**/api/order", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({
        json: {
          orders: [
            {
              id: 23,
              date: new Date().toISOString(),
              items: [
                { title: "Veggie", price: 0.0038 },
                { title: "Pepperoni", price: 0.0042 },
              ],
            },
          ],
        },
      });
    }
    if (method === "POST") {
      const orderReq = route.request().postDataJSON();
      const orderRes = {
        order: { ...orderReq, id: 23 },
        jwt: "eyJpYXQ",
      };
      expect(route.request().method()).toBe("POST");
      await route.fulfill({ json: orderRes });
    }
  });
}

test("updateUser", async ({ page }) => {
  await basicInit(page);
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
  await basicInit(page);
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
  await page.locator("#password").click();
  await page.locator("#password").fill("dinerx");
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  // test new password
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill("dinerx");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("link", { name: "pd" })).toBeVisible();
});

test("change email", async ({ page }) => {
  await basicInit(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await page.getByRole("link", { name: "kc" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').fill("t@jwt.com");
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("t@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(
    page.getByText("The web's best pizza", { exact: true })
  ).toBeVisible();
});

test("franchisee update info", async ({ page }) => {
  await basicInit(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "fc" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza franchisee");
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').fill("t@jwt.com");
  await page.locator("#password").click();
  await page.locator("#password").fill("f");
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("t@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("f");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("link", { name: "pf" })).toBeVisible();
  await page.getByRole("link", { name: "pf" }).click();
  await expect(page.getByText("pizza franchisee")).toBeVisible();
  await expect(page.getByText("Franchisee on")).toBeVisible();
});

test("adim update info", async ({ page }) => {
  await basicInit(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("a@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "am" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  await page.getByRole("textbox").first().fill("pizza admin");
  await page.locator('input[type="email"]').click();
  await page.locator('input[type="email"]').fill("t@jwt.com");
  await page.locator("#password").click();
  await page.locator("#password").fill("f");
  await page.getByRole("button", { name: "Update" }).click();
  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  await page.getByRole("link", { name: "Logout" }).click();
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("t@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("f");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("link", { name: "pa" })).toBeVisible();
  await page.getByRole("link", { name: "pa" }).click();
  await expect(page.getByText("pizza admin")).toBeVisible();
  await expect(page.getByText("role:")).toBeVisible();
  await expect(page.getByText("admin", { exact: true })).toBeVisible();
});

test("admin list users", async ({ page }) => {
  await basicInit(page);
  await page.goto("/");
  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("a@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(
    page.getByRole("row", { name: "Submit", exact: true }).getByRole("button")
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Fran Chise" })).toBeVisible();
  await page.getByRole("textbox", { name: "Filter users" }).click();
  await page.getByRole("textbox", { name: "Filter users" }).fill("k");
  await page
    .getByRole("cell", { name: "k Submit" })
    .getByRole("button")
    .click();
  await expect(page.getByRole("cell", { name: "Kai Chen" })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Fran Chise" })
  ).not.toBeVisible();
});

test("admin delete user", async ({ page }) => {
  await basicInit(page);
  await page.goto("/");
  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("a@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  await page.getByRole('row', { name: 'Kai Chen d@jwt.com diner' }).getByRole('button').click();
  await expect(page.getByText('Delete User')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('row', { name: 'Kai Chen d@jwt.com diner' })).not.toBeVisible();
});
