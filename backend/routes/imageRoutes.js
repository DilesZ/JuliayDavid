const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const authMiddleware = require('../middleware/auth');

// Configurar almacenamiento de multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', '..', 'uploads');

        // Crear carpeta si no existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'img-' + uniqueSuffix + ext);
    }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // Límite de 10MB
    fileFilter: fileFilter
});

// GET - Obtener todas las imágenes (público)
router.get('/', (req, res) => {
    db.all("SELECT * FROM images ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            console.error('Error al obtener imágenes:', err);
            return res.status(500).json({ error: 'Error al obtener imágenes' });
        }
        res.json(rows);
    });
});

// POST - Subir nueva imagen (protegido)
router.post('/', authMiddleware, upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const description = req.body.description || 'Sin descripción';
    const imagePath = '/uploads/' + req.file.filename;

    db.run(
        "INSERT INTO images (path, description, uploaded_by) VALUES (?, ?, ?)",
        [imagePath, description, req.user.username],
        function (err) {
            if (err) {
                console.error('Error al guardar imagen en BD:', err);
                return res.status(500).json({ error: 'Error al guardar imagen' });
            }

            res.json({
                message: 'Imagen subida correctamente',
                image: {
                    id: this.lastID,
                    path: imagePath,
                    description: description,
                    uploaded_by: req.user.username
                }
            });
        }
    );
});

// DELETE - Eliminar imagen (protegido)
router.delete('/:id', authMiddleware, (req, res) => {
    const imageId = req.params.id;

    // Primero obtener la ruta de la imagen
    db.get("SELECT * FROM images WHERE id = ?", [imageId], (err, image) => {
        if (err) {
            console.error('Error al buscar imagen:', err);
            return res.status(500).json({ error: 'Error al buscar imagen' });
        }

        if (!image) {
            return res.status(404).json({ error: 'Imagen no encontrada' });
        }

        // Eliminar archivo físico si está en uploads
        if (image.path.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', '..', image.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Eliminar de la base de datos
        db.run("DELETE FROM images WHERE id = ?", [imageId], (err) => {
            if (err) {
                console.error('Error al eliminar imagen:', err);
                return res.status(500).json({ error: 'Error al eliminar imagen' });
            }

            res.json({ message: 'Imagen eliminada correctamente' });
        });
    });
});

module.exports = router;
