const { AuthenticationError } = require("apollo-server-express");
const { User, Product, Cart, Order } = require("../models");
const { signToken } = require("../utils/auth");
const stripe = require("stripe")("sk_test_4eC39HqLyjWDarjtT1zdp7dc");

const resolvers = {
  Query: {
    user: async (parent, args, context) => {
      if (context.user) {
        const user = await User.findOne({ _id: context.user._id }).populate({
          path: "orders.products",
          populate: "category",
        });

        user.orders.sort((a, b) => b.purchaseDate - a.purchaseDate);

        return user;
      }

      throw new AuthenticationError("Not logged in");
    },

    categories: async () => {
      return await Category.find();
    },

    products: async (parent, { title }) => {
      const params = {};

      if (title) {
        params.title = {
          $regex: title,
        };
      }
      return await Product.find(params);
    },

    product: async (parent, { _id }) => {
      return await Product.findById(_id);
    },

    order: async (parent, { _id }, context) => {
      if (context.user) {
        const user = await User.findById(context.user._id).populate({
          path: "orders.products",
          populate: "category",
        });

        return user.orders.id(_id);
      }

      throw new AuthenticationError("Not logged in");
    },

    // // This will give us the base domain that the request came from.
    // // Locally, that would be http://localhost:3001,
    // // since the GraphQL Playground is running on port 3001.
    // checkout: async (parent, args, context) => {
    //   const url = new URL(context.headers.referer).origin;

    //   console.log(url);

    //   const order = new Order({ products: args.products });
    //   const { products } = await order.populate("products").execPopulate();
    //   const line_items = [];

    //   for (let i = 0; i < products.length; i++) {
    //     // generate product id
    //     const product = await stripe.products.create({
    //       name: products[i].name,
    //       description: products[i].description,
    //       // These image thumbnails won't display on the Stripe checkout page
    //       // when testing locally, because Stripe can't download images
    //       // that are being served from your personal computer's localhost.
    //       // You will only see these images when you deploy the app to Heroku.
    //       images: [`${url}/images/${products[i].image}`],
    //     });

    //     // generate price id using the product id
    //     const price = await stripe.prices.create({
    //       product: product.id,
    //       unit_amount: products[i].price * 100,
    //       currency: "usd",
    //     });

    //     // add price id to the line items array
    //     line_items.push({
    //       price: price.id,
    //       quantity: 1,
    //     });
    //   }
    //   const session = await stripe.checkout.sessions.create({
    //     payment_method_types: ["card"],
    //     line_items,
    //     mode: "payment",
    //     success_url: `${url}/success?session_id={CHECKOUT_SESSION_ID}`,
    //     cancel_url: `${url}/`,
    //   });

    //   return { session: session.id };
    // },
  },
  Mutation: {
    login: async (parent, { email, password }) => {
      const user = await User.findOne({ email });

      if (!user) {
        throw new AuthenticationError("Cannot find user with email: " + email);
      }

      const correctPw = await user.isCorrectPassword(password);

      if (!correctPw) {
        throw new AuthenticationError("Incorrect Password");
      }

      const token = signToken(user);

      return { token, user };
    },

    addUser: async (parent, args) => {
      const user = await User.create(args);
      const token = signToken(user);

      return { token, user };
    },

    addOrder: async (parent, { products }, context) => {
      console.log(context);
      if (context.user) {
        const order = new Order({ products });

        await User.findByIdAndUpdate(context.user._id, {
          $push: { orders: order },
        });

        return order;
      }

      throw new AuthenticationError("Not logged in");
    },
    updateUser: async (parent, args, context) => {
      if (context.user) {
        return await User.findByIdAndUpdate(context.user._id, args, {
          new: true,
        });
      }

      throw new AuthenticationError("Not logged in");
    },
    updateProduct: async (parent, { _id, quantity }) => {
      const decrement = Math.abs(quantity) * -1;

      return await Product.findByIdAndUpdate(
        _id,
        { $inc: { quantity: decrement } },
        { new: true }
      );
    },
  },
};

module.exports = resolvers;