import express from "express";
import { neon } from '@neondatabase/serverless';
import regiones from "../public/javascript/regionesChile.js"; 
import validator from "validator";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import multer from 'multer';
import path from 'path';

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';
let login = false;
console.log('Archivo auth.js cargado');
const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];
  console.log('Token recibido:', token);
  if (token) {
    try {
      req.user = jwt.verify(token, CLAVE);
      console.log('Usuario autenticado:', req.user);
      next();
    } catch (e) {
      console.error('Error al verificar el token:', e);
      res.redirect('/auth/login');
    }
  } else {
    console.log('No se recibió token');
    res.redirect('/auth/login');
  }
};

const is_auth = (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];

  try {
    req.user = jwt.verify(token, CLAVE);
    res.redirect('/');
  } catch (e) {
    next();
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/'); // Carpeta donde se guardarán las imágenes
  },
  filename: function (req, file, cb) {
    // Renombrar el archivo para evitar conflictos
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

router.get('/register', is_auth, function(req, res, next) {
  const error = req.query.error;
  res.render('register', { title: 'Registro', isIndex: false, regiones: regiones.regions, login: login, error: error });
});

router.post('/register', async function(req, res, next) {
  const data = req.body;

  if (
    data.name &&
    data.lastname &&
    data.address &&
    validator.isEmail(data.email) &&
    data.password.length >= 8 &&
    data.password2 === data.password
  ) {
    const name = data.name;
    const lastname = data.lastname;
    const money = 0;
    const is_admin = false;
    const email = data.email;
    const password = bcrypt.hashSync(data.password, 5);
    const address = data.address;

    const query = `INSERT INTO usuarios (nombre, apellido, dinero, es_admin, email, password, direccion) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_usuario`;
    const values = [name, lastname, money, is_admin, email, password, address];

    try {
      const result = await sql(query, values);
      const [{ id_usuario }] = result;

      const fiveMinuteFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
      const token = jwt.sign({ id: id_usuario, exp: fiveMinuteFromNowInSeconds }, CLAVE);

      res.cookie(AUTH_COOKIE_NAME, token, { maxAge: 60 * 5 * 1000 });
      login = true;

      res.redirect('/auth/login');
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      res.redirect('/auth/register?error=invalid');
    }
  } else {
    res.redirect('/auth/register?error=invalid');
  }
});

router.get('/login', is_auth, function(req, res, next) {
  const error = req.query.error;
  res.render('login', { title: 'Iniciar Sesión', isIndex: false, login: login, error: error });
});



router.post('/login', async function(req, res, next) {
  const { email, password } = req.body;
  const query = 'SELECT id_usuario, password FROM usuarios WHERE email = $1';
  const results = await sql(query, [email]);

  if (results.length === 0) {
    res.redirect('/auth/login?error=unknown');
    return;
  }

  const id_usuario = results[0].id_usuario;
  const hash = results[0].password;

  const passwordMatch = await bcrypt.compare(password, hash);

  if (passwordMatch) {
    const fiveMinuteFromNowInSeconds = Math.floor(Date.now() / 1000) + 5 * 60;
    const token = jwt.sign({ id: id_usuario, exp: fiveMinuteFromNowInSeconds }, CLAVE);

    res.cookie(AUTH_COOKIE_NAME, token, { maxAge: 60 * 5 * 1000 });

    res.redirect('/');
    return;
  }

  res.redirect('/auth/login?error=unknown');
});

router.get('/administracion', authMiddleware, async function(req, res, next) {
  const query = 'SELECT es_admin FROM usuarios WHERE id_usuario = $1';
  const result = await sql(query, [req.user.id]);

  if (result.length > 0 && result[0].es_admin) {
    res.render('administracion', { title: 'Admin', isIndex: false });
  } else {
    res.redirect('/');
  }
});

router.get('/productos', authMiddleware, async function(req, res, next) {
  const query = 'SELECT es_admin FROM usuarios WHERE id_usuario = $1';
  const result = await sql(query, [req.user.id]);

  if (result.length > 0 && result[0].es_admin) {
    const products = await sql('SELECT * FROM productos');
    res.render('productos', { title: 'Productos', isIndex: false, products: products });
  } else {
    res.redirect('/');
  }
});

// Mostrar formulario para crear producto
router.get('/crear_producto', authMiddleware, async function(req, res, next) {
  const id_usuario = req.user.id;

  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    res.render('crear_producto', { title: 'Crear Producto' });
  } else {
    res.redirect('/');
  }
});

// Procesar formulario de creación de producto
router.post('/crear_producto', authMiddleware, upload.single('imagen'), async function(req, res, next) {
  const id_usuario = req.user.id;

  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    // Agregar 'descripcion' en la desestructuración
    const { nombre, precio, material, tipo, cantidad, descripcion } = req.body;
    const imagen = req.file ? req.file.filename : null;

    const query = `INSERT INTO productos (nombre, precio, material, tipo, cantidad, descripcion, imagen) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    await sql(query, [nombre, precio, material, tipo, cantidad, descripcion, imagen]);

    res.redirect('/auth/productos'); // Redirige a la lista de productos
  } else {
    res.redirect('/');
  }
});


// Mostrar formulario para editar producto
router.get('/editar_producto/:id_producto', authMiddleware, async function(req, res, next) {
  const id_usuario = req.user.id;
  const id_producto = req.params.id_producto;

  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    const [producto] = await sql('SELECT * FROM productos WHERE id_producto = $1', [id_producto]);

    if (producto) {
      res.render('editar_producto', { title: 'Editar Producto', producto });
    } else {
      res.redirect('/auth/productos');
    }
  } else {
    res.redirect('/');
  }
});

router.post('/eliminar_producto/:id_producto', authMiddleware, async function(req, res, next) {
  const id_producto = req.params.id_producto;

  try {
    // Eliminar referencias al producto en `producto_historial`
    await sql('DELETE FROM producto_historial WHERE id_producto = $1', [id_producto]);

    // Eliminar referencias al producto en `producto_carrito`
    await sql('DELETE FROM producto_carrito WHERE id_producto = $1', [id_producto]);

    // Luego elimina el producto de `productos`
    await sql('DELETE FROM productos WHERE id_producto = $1', [id_producto]);

    res.redirect('/auth/productos');
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).send('Error al eliminar el producto');
  }
});




// Ruta para eliminar producto
router.post('/eliminar_producto/:id_producto', authMiddleware, async function(req, res, next) {
  const id_usuario = req.user.id;
  const id_producto = req.params.id_producto;

  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    await sql('DELETE FROM productos WHERE id_producto = $1', [id_producto]);

    res.redirect('/auth/productos');
  } else {
    res.redirect('/');
  }
});


router.get('/logout', function(req, res) {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.redirect('/');
});

// Ruta para ver el historial de ventas (solo admins)
router.get('/historial_ventas', authMiddleware, async (req, res) => {
  const id_usuario = req.user.id;

  // Verificar si el usuario es administrador
  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length === 0 || !result[0].es_admin) {
    res.redirect('/');
    return;
  }

  try {
    const ventas = await sql('SELECT * FROM historial_compras ORDER BY fecha DESC');

    // Para cada venta, obtener los productos y el nombre del usuario
    for (let venta of ventas) {
      const productos = await sql('SELECT ph.*, p.nombre FROM producto_historial ph JOIN productos p ON ph.id_producto = p.id_producto WHERE ph.id_compra = $1', [venta.id_compra]);
      venta.productos = productos;

      const [usuario] = await sql('SELECT nombre, apellido FROM usuarios WHERE id_usuario = $1', [venta.id_usuario]);
      venta.usuario = usuario;
    }

    res.render('historial_ventas', { title: 'Historial de Ventas', ventas });
  } catch (error) {
    console.error('Error al obtener el historial de ventas:', error);
    res.status(500).send('Error al obtener el historial de ventas');
  }
});


export default router;
