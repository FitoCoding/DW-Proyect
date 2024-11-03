import express from "express";
import { neon } from '@neondatabase/serverless';
import regiones from "../public/javascript/regionesChile.js"; 
import validator from "validator";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import multer from 'multer';
import path from 'path';

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';
const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];
  if (token) {
    try {
      req.user = jwt.verify(token, CLAVE);
      next();
    } catch (e) {
      res.status(401).json({ status: "error", message: "Token inválido" });
    }
  } else {
    res.status(401).json({ status: "error", message: "Token no proporcionado" });
  }
};

const is_auth = (req, res, next) => {
  const token = req.cookies[AUTH_COOKIE_NAME];
  try {
    req.user = jwt.verify(token, CLAVE);
    res.json({ status: "success", message: "Ya está autenticado" });
  } catch (e) {
    next();
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ruta de registro
router.post('/register', async (req, res) => {
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
      const token = jwt.sign({ id: id_usuario }, CLAVE, { expiresIn: '5m' });

      res.json({ status: "success", token });
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      res.status(500).json({ status: "error", message: "Error al registrar el usuario" });
    }
  } else {
    res.status(400).json({ status: "error", message: "Datos de registro inválidos" });
  }
});

// Ruta de inicio de sesión
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT id_usuario, password FROM usuarios WHERE email = $1';
  try {
    const results = await sql(query, [email]);
    if (results.length === 0) {
      res.status(404).json({ status: "error", message: "Usuario no encontrado" });
      return;
    }

    const id_usuario = results[0].id_usuario;
    const hash = results[0].password;
    const passwordMatch = await bcrypt.compare(password, hash);

    if (passwordMatch) {
      const token = jwt.sign({ id: id_usuario }, CLAVE, { expiresIn: '5m' });
      res.json({ status: "success", token });
    } else {
      res.status(401).json({ status: "error", message: "Contraseña incorrecta" });
    }
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ status: "error", message: "Error al iniciar sesión" });
  }
});

// Ruta para cerrar sesión (elimina la cookie del token)
router.post('/logout', (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME);
  res.json({ status: "success", message: "Sesión cerrada" });
});

// Ruta para ver la página de administración (solo admins)
router.get('/administracion', authMiddleware, async (req, res) => {
  const query = 'SELECT es_admin FROM usuarios WHERE id_usuario = $1';
  const result = await sql(query, [req.user.id]);
  if (result.length > 0 && result[0].es_admin) {
    res.json({ status: "success", message: "Bienvenido a la administración" });
  } else {
    res.status(403).json({ status: "error", message: "No autorizado" });
  }
});

// Ruta para ver todos los productos (solo admins)
router.get('/productos', authMiddleware, async (req, res) => {
  const query = 'SELECT es_admin FROM usuarios WHERE id_usuario = $1';
  const result = await sql(query, [req.user.id]);

  if (result.length > 0 && result[0].es_admin) {
    const products = await sql('SELECT * FROM productos');
    res.json({ status: "success", products });
  } else {
    res.status(403).json({ status: "error", message: "No autorizado" });
  }
});

// Ruta para crear un producto (solo admins)
router.post('/crear_producto', authMiddleware, upload.single('imagen'), async (req, res) => {
  const id_usuario = req.user.id;
  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    const { nombre, precio, material, tipo, cantidad, descripcion } = req.body;
    const imagen = req.file ? req.file.filename : null;

    const query = `INSERT INTO productos (nombre, precio, material, tipo, cantidad, descripcion, imagen) VALUES ($1, $2, $3, $4, $5, $6, $7)`;
    await sql(query, [nombre, precio, material, tipo, cantidad, descripcion, imagen]);

    res.json({ status: "success", message: "Producto creado" });
  } else {
    res.status(403).json({ status: "error", message: "No autorizado" });
  }
});

// Ruta para editar un producto (solo admins)
router.put('/editar_producto/:id_producto', authMiddleware, async (req, res) => {
  const id_usuario = req.user.id;
  const id_producto = req.params.id_producto;
  const result = await sql('SELECT es_admin FROM usuarios WHERE id_usuario = $1', [id_usuario]);

  if (result.length > 0 && result[0].es_admin) {
    const { nombre, precio, material, tipo, cantidad, descripcion } = req.body;
    const query = `UPDATE productos SET nombre = $1, precio = $2, material = $3, tipo = $4, cantidad = $5, descripcion = $6 WHERE id_producto = $7`;
    await sql(query, [nombre, precio, material, tipo, cantidad, descripcion, id_producto]);

    res.json({ status: "success", message: "Producto actualizado" });
  } else {
    res.status(403).json({ status: "error", message: "No autorizado" });
  }
});

// Ruta para eliminar un producto (solo admins)
router.delete('/eliminar_producto/:id_producto', authMiddleware, async (req, res) => {
  const id_producto = req.params.id_producto;
  try {
    await sql('DELETE FROM producto_historial WHERE id_producto = $1', [id_producto]);
    await sql('DELETE FROM producto_carrito WHERE id_producto = $1', [id_producto]);
    await sql('DELETE FROM productos WHERE id_producto = $1', [id_producto]);

    res.json({ status: "success", message: "Producto eliminado" });
  } catch (error) {
    console.error('Error al eliminar el producto:', error);
    res.status(500).json({ status: "error", message: "Error al eliminar el producto" });
  }
});

export default router;
