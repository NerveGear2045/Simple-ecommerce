const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const Product = require('../models/product');
const Order = require('../models/order');

const ITEM_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalProducts;

  Product.find()
    .countDocuments()
    .then(sumProd => {
      totalProducts = sumProd;
      return Product.find()
        .skip((page - 1) * ITEM_PER_PAGE)
        .limit(ITEM_PER_PAGE);
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'All Products',
        path: '/products',
        totalProducts: totalProducts,
        currentPage: page,
        hasNextPage: page * ITEM_PER_PAGE < totalProducts,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalProducts / ITEM_PER_PAGE),
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products',
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalProducts;

  Product.find()
    .countDocuments()
    .then(sumProd => {
      totalProducts = sumProd;
      return Product.find()
        .skip((page - 1) * ITEM_PER_PAGE)
        .limit(ITEM_PER_PAGE);
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        totalProducts: totalProducts,
        currentPage: page,
        hasNextPage: page * ITEM_PER_PAGE < totalProducts,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalProducts / ITEM_PER_PAGE),
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      // console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items;
      let totalPrice = 0;
      products.forEach(prod => {
        totalPrice += prod.quantity * prod.productId.price;
      });
      res.render('shop/checkout', {
        pageTitle: 'Checkout',
        path: '/checkout',
        products: products,
        totalPrice: totalPrice,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders,
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No invoice found'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const fileName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', fileName);
      const pdfDoc = new PDFDocument();
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + fileName + '"'
      );
      const shortId = order._id.toString().slice(0, 6);
      pdfDoc.fontSize(25).text('INVOICE - #' + shortId);
      pdfDoc.text('================================');
      let totalPrice = 0;
      order.products.forEach(prod => {
        pdfDoc.text(
          prod.product.title +
            ' x' +
            prod.quantity +
            ' - $' +
            prod.product.price
        );
        totalPrice += prod.quantity * prod.product.price;
      });
      pdfDoc.text('-------');
      pdfDoc
        .fontSize(22)
        .fillColor('green')
        .text('Total price: $' + totalPrice);
      pdfDoc.end();
    })
    .catch(error => next(error));
};
