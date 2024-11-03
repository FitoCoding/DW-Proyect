import express from "express";
import { neon } from '@neondatabase/serverless';
import jwt from "jsonwebtoken";

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
var router = express.Router();

const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';

// Ruta principal para obtener productos destacados
router.get('/', async function(req, res) {
  try {
    // Consulta para obtener los últimos 9 productos
    const productosDestacados = await sql("SELECT * FROM productos ORDER BY id_producto DESC LIMIT 9");

    let isLogged = false;
    if (req.cookies[AUTH_COOKIE_NAME]) {
      isLogged = true;
    }

    res.json({
      status: "success",
      title: 'Niluan',
      isIndex: true,
      productosDestacados,
      login: isLogged
    });
  } catch (error) {
    console.error('Error al obtener los productos destacados:', error);
    res.status(500).json({ status: "error", message: "Error al obtener los productos destacados" });
  }
});

// Ruta para mostrar todo el catálogo
router.get('/catalogo', async function(req, res) {
  try {
    const products = await sql("SELECT * FROM productos");
    res.json({ status: "success", products });
  } catch (error) {
    console.error('Error al obtener el catálogo:', error);
    res.status(500).json({ status: "error", message: "Error al obtener el catálogo" });
  }
});

// Ruta para buscar productos por nombre
router.get('/buscar', async (req, res) => {
  const { query } = req.query;
  try {
    const productos = await sql("SELECT * FROM productos WHERE LOWER(nombre) LIKE LOWER($1)", [`%${query}%`]);
    res.json({ status: "success", products: productos });
  } catch (error) {
    console.error('Error al realizar la búsqueda:', error);
    res.status(500).json({ status: "error", message: "Error al realizar la búsqueda" });
  }
});

// Ruta para mostrar un solo producto por id
router.get('/producto/:id', async function(req, res) {
  const id = req.params.id;
  try {
    const product = await sql("SELECT * FROM productos WHERE id_producto = $1", [id]);
    if (product.length > 0) {
      res.json({ status: "success", product: product[0] });
    } else {
      res.status(404).json({ status: "error", message: "Producto no encontrado" });
    }
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ status: "error", message: "Error al obtener el producto" });
  }
});

// Ruta de contacto
router.get('/contacto', (req, res) => {
  res.json({ status: "success", message: "Página de contacto" });
});

export default router;
