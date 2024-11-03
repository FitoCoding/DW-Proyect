import express from "express";
import createError from "http-errors";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import {fileURLToPath} from "url";
import {engine} from "express-handlebars";
import jwt from "jsonwebtoken";
import { neon } from '@neondatabase/serverless';

import indexRouter from "./routes/index.js";
import authRouter from "./routes/auth.js";
import cartRouter from './routes/cart.js';
import userRouter from './routes/user.js';

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurar cookieParser antes del middleware de verificación de token
app.use(cookieParser());

app.use(async (req, res, next) => {
  // Excluir las rutas de login y registro
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    res.locals.cartItems = [];
    res.locals.cartTotal = 0;
    res.locals.login = false;
    res.locals.userProfile = null;
    return next(); // Salir del middleware y pasar a la siguiente función
  }

  const token = req.cookies[AUTH_COOKIE_NAME];
  
  if (token) {
    try {
      const user = jwt.verify(token, CLAVE);
      req.user = user;
      const id_usuario = user.id;

      // Consulta para obtener el carrito y el perfil del usuario autenticado
      const carrito = await sql(`
        SELECT p.nombre, p.precio, p.imagen, pc.cantidad_producto, (p.precio * pc.cantidad_producto) AS precio_total
        FROM producto_carrito pc
        JOIN productos p ON pc.id_producto = p.id_producto
        JOIN carrito c ON pc.id_carrito = c.id_carrito
        WHERE c.id_usuario = $1
      `, [id_usuario]);

      const totalCarrito = carrito.reduce((total, item) => total + item.precio_total, 0);

      // Obtener detalles del perfil, incluyendo el saldo y si es administrador
      const [perfil] = await sql('SELECT nombre, apellido, email, dinero, es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

      // Pasar datos al contexto de todas las vistas
      res.locals.cartItems = carrito;
      res.locals.cartTotal = totalCarrito;
      res.locals.login = true;
      res.locals.userProfile = perfil;

    } catch (e) {
      console.error("Error al verificar el token:", e);
      res.locals.cartItems = [];
      res.locals.cartTotal = 0;
      res.locals.login = false;
      res.locals.userProfile = null;
    }
  } else {
    res.locals.cartItems = [];
    res.locals.cartTotal = 0;
    res.locals.login = false;
    res.locals.userProfile = null;
  }

  next();
});


// view engine setup
app.engine('handlebars', engine({
  defaultLayout: 'main',
  layoutsDir: __dirname + '/views/layouts/',
  partialsDir: __dirname + '/views/partials/'
}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', indexRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api', userRouter);
app.use(express.static('public'));

// catch 404 and forward to error handler
/* app.use(function(req, res, next) {
  next(createError(404));
}); */

// error handler
/* app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});
 */
export default app;
