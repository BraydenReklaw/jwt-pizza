import { test, expect } from "playwright-test-coverage";
import { User, Role } from "../src/service/pizzaService";
import { Page } from "@playwright/test";

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
    //   const franchiseRes = {
    //     franchises: [
    //       {
    //         id: 2,
    //         name: "LotaPizza",
    //         stores: [
    //           { id: 4, name: "Lehi" },
    //           { id: 5, name: "Springville" },
    //           { id: 6, name: "American Fork" },
    //         ],
    //       },
    //       { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
    //       { id: 4, name: "topSpot", stores: [] },
    //     ],
    //   };
    //   expect(route.request().method()).toBe("GET");
    //   await route.fulfill({ json: franchiseRes });
    // });
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

  await page.goto("/");
}

test("login", async ({ page }) => {
  await basicInit(page);
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();
});

test("purchase with login", async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole("button", { name: "Order now" }).click();

  // Create order
  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  // Login
  await page.getByPlaceholder("Email address").click();
  await page.getByPlaceholder("Email address").fill("d@jwt.com");
  await page.getByPlaceholder("Email address").press("Tab");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Pay
  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!"
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  // Check balance
  await expect(page.getByText("0.008")).toBeVisible();
});

test("diner access other pages", async ({ page }) => {
  await basicInit(page);
  // login
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  // navigate to other pages (About, History, Franchise, Dashboard)
  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByText("The secret sauce")).toBeVisible();
  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByText("Mama Rucci, my my")).toBeVisible();
  await page
    .getByRole("contentinfo")
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByText("So you want a piece of the")).toBeVisible();
  await page.getByRole("link", { name: "home" }).click();
  await expect(
    page.getByText("The web's best pizza", { exact: true })
  ).toBeVisible();
  await page.getByRole("link", { name: "KC" }).click();
  await expect(page.getByText("Your pizza kitchen")).toBeVisible();
  // await page.getByRole('link', { name: 'KC' }).click();
  // await expect(page.getByRole('link', { name: 'diner-dashboard' })).toBeVisible();
});

test("logout", async ({ page }) => {
  await basicInit(page);
  // login
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("d@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  // logout
  await page.getByRole("link", { name: "Logout" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
});

test("register", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Register" }).click();
  await page.getByPlaceholder("Full name").fill("New User");
  await page.getByPlaceholder("Email address").fill("new@jwt.com");
  await page.getByPlaceholder("Password").fill("mypassword");
  await page.getByRole("button", { name: "Register" }).click();

  // After successful registration, user should be logged in
  await expect(page.getByRole("link", { name: "NU" })).toBeVisible();
});

test("franchisee navigates to Franchise Dashboard", async ({ page }) => {
  await basicInit(page);

  // Login as franchisee
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("f@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Verify login success
  await expect(page.getByRole("link", { name: "FC" })).toBeVisible();

  // Navigate to Franchise Dashboard
  await page
    .getByLabel("Global")
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByText("LotaPizza")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Lehi" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create store" })
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Lehi 100 ₿ Close" }).getByRole("button")
  ).toBeVisible();
  await page
    .getByRole("row", { name: "Lehi 100 ₿ Close" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Create store" }).click();
  await expect(page.getByRole("textbox", { name: "store name" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("admin navigates to Admin Dashboard", async ({ page }) => {
  await basicInit(page);

  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("a@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();

  // Verify login success
  await expect(page.getByRole("link", { name: "AM" })).toBeVisible();

  // Navigate to Admin Dashboard
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Franchises" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add Franchise" })
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "LotaPizza Close" }).getByRole("button")
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: "Lehi ₿ Close" }).getByRole("button")
  ).toBeVisible();
});

test("admin opens and closes franchise (canceling the action)", async ({
  page,
}) => {
  await basicInit(page);

  // Login as admin
  await page.getByRole("link", { name: "Login" }).click();
  await page.getByPlaceholder("Email address").fill("a@jwt.com");
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("link", { name: "Admin" }).click();
  await page
    .getByRole("row", { name: "topSpot Close" })
    .getByRole("button")
    .click();
  await expect(page.getByText("Sorry to see you go")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("textbox", { name: "Filter franchises" }).click();
  await page.getByRole("textbox", { name: "Filter franchises" }).fill("Pizza");
  await page
    .getByRole("cell", { name: "Pizza Submit" })
    .getByRole("button")
    .click();
});
