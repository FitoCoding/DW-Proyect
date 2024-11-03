import express from 'express';
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const sql = neon('postgresql://neondb_owner:tMp4xVi6RoSf@ep-shiny-river-a5eaycry.us-east-2.aws.neon.tech/neondb?sslmode=require');
const router = express.Router();

const CLAVE = 'incrediblepassword';
const AUTH_COOKIE_NAME = 'lol';

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

// Ruta para agregar producto al carrito
router.post('/add/:id_producto', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    const id_producto = req.params.id_producto;
    const cantidad = parseInt(req.body.quantity) || 1;

    try {
        let result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
        let id_carrito;

        if (result.length === 0) {
            result = await sql('INSERT INTO carrito (id_usuario) VALUES ($1) RETURNING id_carrito', [id_usuario]);
            id_carrito = result[0].id_carrito;
        } else {
            id_carrito = result[0].id_carrito;
        }

        result = await sql('SELECT cantidad_producto FROM producto_carrito WHERE id_carrito = $1 AND id_producto = $2', [id_carrito, id_producto]);

        if (result.length === 0) {
            await sql('INSERT INTO producto_carrito (id_carrito, id_producto, cantidad_producto) VALUES ($1, $2, $3)', [id_carrito, id_producto, cantidad]);
        } else {
            const nuevaCantidad = result[0].cantidad_producto + cantidad;
            await sql('UPDATE producto_carrito SET cantidad_producto = $1 WHERE id_carrito = $2 AND id_producto = $3', [nuevaCantidad, id_carrito, id_producto]);
        }

        res.json({ status: "success", message: "Producto agregado al carrito" });
    } catch (error) {
        console.error('Error al agregar al carrito:', error);
        res.status(500).json({ status: "error", message: "Error al agregar al carrito" });
    }
});

// Ruta para ver el carrito
router.get('/', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    
    try {
        const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);
  
        if (result.length === 0) {
            res.json({ status: "success", products: [] });
            return;
        }

        const id_carrito = result[0].id_carrito;
    
        const products = await sql(`
            SELECT p.*, pc.cantidad_producto, (p.precio * pc.cantidad_producto) AS precio_total
            FROM producto_carrito pc
            JOIN productos p ON pc.id_producto = p.id_producto
            WHERE pc.id_carrito = $1
        `, [id_carrito]);
    
        res.json({ status: "success", products });
    } catch (error) {
        console.error('Error al obtener el carrito:', error);
        res.status(500).json({ status: "error", message: "Error al obtener el carrito" });
    }
});
  
// Ruta para eliminar un producto del carrito
router.post('/remove/:id_producto', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;
    const id_producto = req.params.id_producto;

    try {
        const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);

        if (result.length === 0) {
            res.json({ status: "success", message: "El usuario no tiene carrito" });
            return;
        }

        const id_carrito = result[0].id_carrito;

        await sql('DELETE FROM producto_carrito WHERE id_carrito = $1 AND id_producto = $2', [id_carrito, id_producto]);

        res.json({ status: "success", message: "Producto eliminado del carrito" });
    } catch (error) {
        console.error('Error al eliminar del carrito:', error);
        res.status(500).json({ status: "error", message: "Error al eliminar del carrito" });
    }
});

// Ruta para procesar el pago del carrito
router.post('/checkout', authMiddleware, async (req, res) => {
    const id_usuario = req.user.id;

    try {
        const result = await sql('SELECT id_carrito FROM carrito WHERE id_usuario = $1', [id_usuario]);

        if (result.length === 0) {
            res.json({ status: "error", message: "El usuario no tiene carrito" });
            return;
        }

        const id_carrito = result[0].id_carrito;

        const products = await sql(`
            SELECT p.*, pc.cantidad_producto, (p.precio * pc.cantidad_producto) AS precio_total
            FROM producto_carrito pc
            JOIN productos p ON pc.id_producto = p.id_producto
            WHERE pc.id_carrito = $1
        `, [id_carrito]);

        const monto_total = products.reduce((total, item) => total + parseFloat(item.precio_total), 0);

        for (const item of products) {
            if (item.cantidad < item.cantidad_producto) {
                res.json({ status: "error", message: `Stock insuficiente para el producto ${item.nombre}` });
                return;
            }
        }

        const [user] = await sql('SELECT dinero FROM usuarios WHERE id_usuario = $1', [id_usuario]);
        const saldo_actual = parseFloat(user.dinero);

        if (saldo_actual < monto_total) {
            res.json({ status: "error", message: "Saldo insuficiente para completar la compra" });
            return;
        }

        const nuevo_saldo = saldo_actual - monto_total;
        await sql('UPDATE usuarios SET dinero = $1 WHERE id_usuario = $2', [nuevo_saldo, id_usuario]);

        const compraResult = await sql('INSERT INTO historial_compras (id_usuario, monto_total) VALUES ($1, $2) RETURNING id_compra', [id_usuario, monto_total]);
        const id_compra = compraResult[0].id_compra;

        for (const item of products) {
            await sql('INSERT INTO producto_historial (id_compra, id_producto, cantidad, precio) VALUES ($1, $2, $3, $4)', [id_compra, item.id_producto, item.cantidad_producto, item.precio]);
            await sql('UPDATE productos SET cantidad = cantidad - $1 WHERE id_producto = $2', [item.cantidad_producto, item.id_producto]);
        }

        await sql('DELETE FROM producto_carrito WHERE id_carrito = $1', [id_carrito]);

        res.json({ status: "success", message: "Compra realizada exitosamente" });
    } catch (error) {
        console.error('Error al procesar el pago:', error);
        res.status(500).json({ status: "error", message: "Error al procesar el pago" });
    }
});

export default router;

