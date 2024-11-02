// cart.js
import express from 'express';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const router = express.Router();

const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';

console.log('Archivo cart.js cargado');

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

// Ruta para agregar producto al carrito
router.post('/add/:id_producto', authMiddleware, async (req, res) => {
  const id_usuario = req.user.id;
  const id_producto = req.params.id_producto;
  const cantidad = parseInt(req.body.quantity) || 1;

  try {
    // Verificar si el carrito del usuario existe
    let result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
    let id_carrito;

    if (result.length === 0) {
      // Crear un nuevo carrito para el usuario
      result = await sql('INSERT INTO carrito (id_usuario) VALUES ($1) RETURNING id_carrito', [id_usuario]);
      id_carrito = result[0].id_carrito;
    } else {
      id_carrito = result[0].id_carrito;
    }

    // Verificar si el producto ya está en el carrito
    result = await sql('SELECT cantidad_producto FROM producto_carrito WHERE id_carrito = $1 AND id_producto = $2', [id_carrito, id_producto]);

    if (result.length === 0) {
      // Agregar el producto al carrito
      await sql('INSERT INTO producto_carrito (id_carrito, id_producto, cantidad_producto) VALUES ($1, $2, $3)', [id_carrito, id_producto, cantidad]);
    } else {
      // Actualizar la cantidad del producto en el carrito
      const nuevaCantidad = result[0].cantidad_producto + cantidad;
      await sql('UPDATE producto_carrito SET cantidad_producto = $1 WHERE id_carrito = $2 AND id_producto = $3', [nuevaCantidad, id_carrito, id_producto]);
    }

    res.redirect('/catalogo');
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    res.status(500).send('Error al agregar al carrito');
  }
});

// Ruta para ver el carrito
router.get('/', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    console.log('Ingresando a la ruta /cart');
    
    try {
      // Obtener el id_carrito del usuario
      const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
    
      console.log('Resultado de id_carrito:', result);
  
      if (result.length === 0) {
        // El usuario no tiene carrito
        res.render('carrito', { title: 'Carrito', products: [] });
        return;
      }
    
      const id_carrito = result[0].id_carrito;
    
      // Obtener los productos en el carrito
      const products = await sql(`
        SELECT p.*, pc.cantidad_producto, (p.precio * pc.cantidad_producto) AS precio_total
        FROM producto_carrito pc
        JOIN productos p ON pc.id_producto = p.id_producto
        WHERE pc.id_carrito = $1
      `, [id_carrito]);
  
      console.log('Productos en el carrito:', products);
    
      res.render('carrito', { title: 'Carrito', products, login: res.locals.login });
    } catch (error) {
      console.error('Error al obtener el carrito:', error);
      res.status(500).send('Error al obtener el carrito');
    }
  });
  
  // Ruta para eliminar un producto del carrito
router.post('/remove/:id_producto', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    const id_producto = req.params.id_producto;
  
    try {
      // Obtener el id_carrito del usuario
      const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
  
      if (result.length === 0) {
        res.redirect('/cart');
        return;
      }
  
      const id_carrito = result[0].id_carrito;
  
      // Eliminar el producto del carrito
      await sql('DELETE FROM producto_carrito WHERE id_carrito = $1 AND id_producto = $2', [id_carrito, id_producto]);
  
      res.redirect('/cart');
    } catch (error) {
      console.error('Error al eliminar del carrito:', error);
      res.status(500).send('Error al eliminar del carrito');
    }
  });
  

/// Ruta para procesar el pago del carrito
router.post('/checkout', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
  
    try {
      // Obtener el id_carrito del usuario
      const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
  
      if (result.length === 0) {
        res.redirect('/cart');
        return;
      }
  
      const id_carrito = result[0].id_carrito;
  
      // Obtener los productos en el carrito y calcular el monto total
      const products = await sql(`
        SELECT p.*, pc.cantidad_producto, (p.precio * pc.cantidad_producto) AS precio_total
        FROM producto_carrito pc
        JOIN productos p ON pc.id_producto = p.id_producto
        WHERE pc.id_carrito = $1
      `, [id_carrito]);
  
      // Calcular el monto total de la compra
      const monto_total = products.reduce((total, item) => total + parseFloat(item.precio_total), 0);
  
      // Verificar el stock de cada producto
      for (const item of products) {
        if (item.cantidad < item.cantidad_producto) {
          res.render('carrito', { title: 'Carrito', products, error: `Stock insuficiente para el producto ${item.nombre}.`, login: res.locals.login });
          return;
        }
      }
  
      // Obtener el saldo del usuario
      const [user] = await sql('SELECT dinero FROM usuarios WHERE id_usuario = $1', [id_usuario]);
      const saldo_actual = parseFloat(user.dinero);
  
      if (saldo_actual < monto_total) {
        // Saldo insuficiente
        res.render('carrito', { title: 'Carrito', products, error: 'Saldo insuficiente para completar la compra.' });
        return;
      }
  
      // Actualizar el saldo del usuario
      const nuevo_saldo = saldo_actual - monto_total;
      await sql('UPDATE usuarios SET dinero = $1 WHERE id_usuario = $2', [nuevo_saldo, id_usuario]);
  
      // Registrar la compra en historial_compras
      const compraResult = await sql('INSERT INTO historial_compras (id_usuario, monto_total) VALUES ($1, $2) RETURNING id_compra', [id_usuario, monto_total]);
      const id_compra = compraResult[0].id_compra;
  
      for (const item of products) {
        // Registrar en producto_historial
        await sql('INSERT INTO producto_historial (id_compra, id_producto, cantidad, precio) VALUES ($1, $2, $3, $4)', [id_compra, item.id_producto, item.cantidad_producto, item.precio]);
  
        // Actualizar el stock del producto
        await sql('UPDATE productos SET cantidad = cantidad - $1 WHERE id_producto = $2', [item.cantidad_producto, item.id_producto]);
      }
  
      // Vaciar el carrito
      await sql('DELETE FROM producto_carrito WHERE id_carrito = $1', [id_carrito]);
  
      res.redirect('/historial');
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      res.status(500).send('Error al procesar el pago');
    }
  });
  
  
  
export default router;
