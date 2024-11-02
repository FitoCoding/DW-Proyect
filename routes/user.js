// user.js
import express from "express";
import { neon } from '@neondatabase/serverless';
import regiones from "../public/javascript/regionesChile.js"; 
import validator from "validator";
import bcrypt from 'bcryptjs';
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const router = express.Router();
console.log('Archivo user.js cargado');
const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';

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

// Ruta para ver el historial de compras
router.get('/historial', authMiddleware, async (req, res) => {
  const id_usuario = req.user.id;

  try {
    const compras = await sql('SELECT * FROM historial_compras WHERE id_usuario = $1 ORDER BY fecha DESC', [id_usuario]);

    // Para cada compra, obtener los productos
    for (let compra of compras) {
      const productos = await sql('SELECT ph.*, p.nombre FROM producto_historial ph JOIN productos p ON ph.id_producto = p.id_producto WHERE ph.id_compra = $1', [compra.id_compra]);
      compra.productos = productos;
    }

    res.render('historial_user', { title: 'Historial de Compras', compras });
  } catch (error) {
    console.error('Error al obtener el historial:', error);
    res.status(500).send('Error al obtener el historial');
  }
});

// Ruta para ver el perfil del usuario
router.get('/perfil', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
  
    try {
      const [usuario] = await sql('SELECT nombre, apellido, dinero FROM usuarios WHERE id_usuario = $1', [id_usuario]);
  
      res.render('perfil', { title: 'Mi Perfil', usuario });
    } catch (error) {
      console.error('Error al obtener el perfil:', error);
      res.status(500).send('Error al obtener el perfil');
    }
  });

  // Ruta para agregar dinero
router.post('/agregar_dinero', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    const monto = parseFloat(req.body.monto);
  
    if (isNaN(monto) || monto <= 0) {
      res.redirect('/perfil?error=invalid_amount');
      return;
    }
  
    try {
      await sql('UPDATE usuarios SET dinero = dinero + $1 WHERE id_usuario = $2', [monto, id_usuario]);
  
      res.redirect('/perfil');
    } catch (error) {
      console.error('Error al agregar dinero:', error);
      res.status(500).send('Error al agregar dinero');
    }
  });
  
  
export default router;
