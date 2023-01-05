const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "nxtTrendz.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(process.env.PORT || 3003, () =>
      console.log("Server Running at http://localhost:3003/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
}

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const getUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
            INSERT INTO 
               user(username,password,name,gender)
            VALUES(
                '${username}','${hashedPassword}','${name}','${gender}'
            );`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// insert data into table
app.post("/insert/", async (request, response) => {
  const {
    name,
    brand,
    price,
    description,
    originalPrice,
    rating,
    totalRatings,
    gender,
    category,
    availability,
    imageUrl1,
    imageUrl2,
    imageUrl3,
    imageUrl4,
    imageUrl5,
  } = request.body;
  const addProductsQuery = `
            INSERT INTO 
               products(name, brand, price,description, original_price,rating,total_ratings,gender,category,availability,image_url1,image_url2,image_url3,image_url4,image_url5)
            VALUES(
                '${name}', '${brand}', '${price}','${description}', '${originalPrice}','${rating}','${totalRatings}','${gender}','${category}','${availability}','${imageUrl1}','${imageUrl2}','${imageUrl3}','${imageUrl4}','${imageUrl5}'
            );`;
  await db.run(addProductsQuery);
  response.send("Product added successfully");
});

// login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await db.get(selectUserQuery);
  if (databaseUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      password,
      databaseUser.password
    ); //comparing password
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN"); //generating jwt Token
      response.send({ jwtToken });
      console.log(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// products API
app.get("/products/", authenticateToken, async (request, response) => {
  const { sort_by, category = "", title_search = "", rating } = request.query;
  const searchLower = title_search.toLowerCase();
  const ratingInt = rating === "" ? 1 : parseInt(rating);
  const sortBy = sort_by === "PRICE_HIGH" ? "desc" : "asc";
  const productWithoutPrice = `
  select id,name,brand,price,original_price,rating,image_url1 from products
    where category like lower('%${category}%') AND rating >= ${ratingInt}  AND lower(name) like '%${searchLower}%'
  `;
  const getProductsWithPrice = `
    select id,name,brand,price,original_price,rating,image_url1 from products
    where category like lower('%${category}%') AND rating >= ${ratingInt}  AND lower(name) like '%${searchLower}%'
    order by
    price ${sortBy}
  `;
  const getProductsQuery =
    sort_by === "RECOMMENDED" ? productWithoutPrice : getProductsWithPrice;
  //   const getProductsQuery = `
  //     select id,name,brand,price,original_price,rating,image_url1 from products
  //     where category like lower('%${category}%') AND rating >= ${ratingInt}  AND lower(name) like '%${searchLower}%'
  //     order by
  //     price ${sortBy}
  //   `;
  const data = await db.all(getProductsQuery);
  response.send(data);
});

module.exports = app;

// product details api and similar products
app.get("/products/:id/", authenticateToken, async (request, response) => {
  const { id } = request.params;
  const productCategoryQuery = `select category from products where id = ${id}`;
  const categoryObj = await db.get(productCategoryQuery);
  const categoryType = categoryObj.category;
  const getProductDetailsQuery = `
   select * from products where id = ${id}
  `;
  const data = await db.get(getProductDetailsQuery);
  const similarProductsQuery = `
    select id,name,brand,price,original_price,rating,image_url1 from products
    where id <> ${id} and category like '%${categoryType}%' limit 5
  `;
  const similarProducts = await db.all(similarProductsQuery);
  const productsData = {
    productDetails: data,
    similarProducts: similarProducts,
  };
  response.send(productsData);
});

app.get("/latest/products/", authenticateToken, async (request, response) => {
  const latestProductsQuery = `
     select id,name,brand,price,original_price,rating,image_url1 from products limit 6 offset 60
   `;
  const latestProducts = await db.all(latestProductsQuery);
  response.send(latestProducts);
});

app.get("/trending/products/", authenticateToken, async (request, response) => {
  const trendingProductsQuery = `
     select id,name,brand,price,original_price,rating,image_url1,image_url2 from products limit 6 offset 66
   `;
  const trendingProducts = await db.all(trendingProductsQuery);
  response.send(trendingProducts);
});
