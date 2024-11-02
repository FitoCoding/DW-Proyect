import express from "express";
import { neon } from '@neondatabase/serverless';
import jwt from "jsonwebtoken";

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
var router = express.Router();

const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';



router.get('/', async function(req, res, next) {
  // Consulta para obtener los últimos 9 productos
  const productosDestacados = await sql("SELECT * FROM productos ORDER BY id_producto DESC LIMIT 9");

  let isLogged = false;

  if (req.cookies[AUTH_COOKIE_NAME]) {
    isLogged = true;
  }

  res.render('home', {
    title: 'Niluan',
    isIndex: true,
    productosDestacados: productosDestacados,
    login: isLogged
  });
});


// Ruta para mostrar todo el catálogo
router.get('/catalogo', async function(req, res, next) {
  const products = await sql("SELECT * FROM productos");

  let isLogged = false;
  if(req.cookies[AUTH_COOKIE_NAME]){
    isLogged = true;
  }

  res.render('catalogo', { title: 'Productos', isIndex: false, products: products, login: isLogged });
});

// index.js
router.get('/buscar', async (req, res) => {
  const { query } = req.query; // Captura el término de búsqueda desde el parámetro de consulta
  
  try {
    // Consulta para obtener productos cuyo nombre contenga el término de búsqueda (insensible a mayúsculas/minúsculas)
    const productos = await sql("SELECT * FROM productos WHERE LOWER(nombre) LIKE LOWER($1)", [`%${query}%`]);

    res.render('catalogo', { title: 'Resultados de búsqueda', products: productos, login: res.locals.login });
  } catch (error) {
    console.error('Error al realizar la búsqueda:', error);
    res.status(500).send('Error al realizar la búsqueda');
  }
});


// Ruta para mostrar un solo producto por id
router.get('/producto/:id', async function(req, res, next) {
  const id = req.params.id;
  const product = await sql(`SELECT * FROM productos WHERE id_producto = ${id}`);

  let isLogged = false;
  if(req.cookies[AUTH_COOKIE_NAME]){
    isLogged = true;
  }

  res.render('producto', { title: 'Producto', isIndex: false, product: product[0], login: isLogged });
});

// Ruta de contacto
router.get('/contacto', function(req, res, next) {
  let isLogged = false;
  if(req.cookies[AUTH_COOKIE_NAME]){
    isLogged = true;
  }

  res.render('contacto', { title: 'Contacto', isIndex: false, login: isLogged });
});



export default router;
