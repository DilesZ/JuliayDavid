const express = require('express');
const router = express.Router();
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// GET - Obtener todo el contenido (público)
router.get('/', (req, res) => {
    db.all("SELECT * FROM content", (err, rows) => {
        if (err) {
            console.error('Error al obtener contenido:', err);
            return res.status(500).json({ error: 'Error al obtener contenido' });
        }
        res.json(rows);
    });
});

// PUT - Actualizar contenido de una sección (protegido)
router.put('/', authMiddleware, (req, res) => {
    const { section, text } = req.body;

    if (!section || !text) {
        return res.status(400).json({ error: 'Sección y texto son requeridos' });
    }

    // Verificar si la sección existe
    db.get(
        "SELECT * FROM content WHERE section = ?",
        [section],
        (err, row) => {
            if (err) {
                console.error('Error al verificar sección:', err);
                return res.status(500).json({ error: 'Error en el servidor' });
            }

            if (row) {
                // Actualizar sección existente
                db.run(
                    "UPDATE content SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE section = ?",
                    [text, section],
                    (err) => {
                        if (err) {
                            console.error('Error al actualizar contenido:', err);
                            return res.status(500).json({ error: 'Error al actualizar contenido' });
                        }
                        res.json({ message: 'Contenido actualizado correctamente' });
                    }
                );
            } else {
                // Crear nueva sección
                db.run(
                    "INSERT INTO content (section, text) VALUES (?, ?)",
                    [section, text],
                    (err) => {
                        if (err) {
                            console.error('Error al crear contenido:', err);
                            return res.status(500).json({ error: 'Error al crear contenido' });
                        }
                        res.json({ message: 'Contenido creado correctamente' });
                    }
                );
            }
        }
    );
});

module.exports = router;
