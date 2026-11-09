
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// FILE PATHS
// ==========================================

const DATA_FILE = path.join(__dirname, "students.json");
const EVENTS_FILE = path.join(__dirname, "events.json");
const ARCHIVE_FILE = path.join(__dirname, "archived_students.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Create uploads directory if it does not exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ==========================================
// MIDDLEWARE
// ==========================================

// Allow frontend requests during deployment.
// You can restrict allowed origins after testing.
app.use(cors());

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded event images
app.use("/uploads", express.static(UPLOAD_DIR));

// ==========================================
// JSON STORAGE FUNCTIONS
// ==========================================

const readJson = (file, fallback = []) => {
    try {
        if (!fs.existsSync(file)) {
            fs.writeFileSync(
                file,
                JSON.stringify(fallback, null, 2),
                "utf8"
            );
            return fallback;
        }

        const data = JSON.parse(fs.readFileSync(file, "utf8"));

        return Array.isArray(data) ? data : fallback;

    } catch (error) {
        console.error("JSON Read Error:", file, error.message);
        return fallback;
    }
};

const saveJson = (file, value) => {
    try {
        fs.writeFileSync(
            file,
            JSON.stringify(value, null, 2),
            "utf8"
        );
        return true;
    } catch (error) {
        console.error("JSON Save Error:", file, error.message);
        throw error;
    }
};

const readStudents = () => readJson(DATA_FILE);
const readEvents = () => readJson(EVENTS_FILE);
const readArchivedStudents = () => readJson(ARCHIVE_FILE);

// ==========================================
// IMAGE UPLOAD CONFIGURATION
// ==========================================

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, UPLOAD_DIR);
        },

        filename: (req, file, cb) => {
            const safeName = file.originalname.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

            cb(null, Date.now() + "-" + safeName);
        }
    }),

    limits: {
        fileSize: 8 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, PNG, WEBP, and GIF images are allowed."));
        }
    }
});

// ==========================================
// API HOME AND HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "Saint Joseph College Student Information System Backend is running."
    });
});

app.get("/api", (req, res) => {
    res.json({
        status: "success",
        message: "Saint Joseph College Student Information System API",
        endpoints: [
            "/api/health",
            "/api/students",
            "/api/students/archive",
            "/api/events"
        ]
    });
});

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        status: "online",
        message: "Student Information System API is running."
    });
});

// ==========================================
// STUDENT MANAGEMENT
// ==========================================

// GET ALL ACTIVE STUDENTS

app.get("/api/students", (req, res) => {
    try {
        res.json(readStudents());
    } catch (error) {
        console.error(error);
        res.status(500).json({
            message: "Unable to retrieve student records."
        });
    }
});

// ADD STUDENT

app.post("/api/students", (req, res) => {
    try {
        const {
            studentId,
            firstName,
            middleName = "",
            lastName,
            email,
            program,
            course,
            year
        } = req.body;

        if (
            ![
                studentId,
                firstName,
                lastName,
                email,
                program,
                course,
                year
            ].every(value => String(value || "").trim())
        ) {
            return res.status(400).json({
                message: "Please complete all required fields."
            });
        }

        const students = readStudents();

        const normalizedId = String(studentId).trim().toLowerCase();
        const normalizedEmail = String(email).trim().toLowerCase();

        const duplicate = students.some(student =>
            String(student.studentId).toLowerCase() === normalizedId ||
            String(student.email).toLowerCase() === normalizedEmail
        );

        if (duplicate) {
            return res.status(409).json({
                message: "Student ID or email address is already registered."
            });
        }

        const student = {
            id: Date.now().toString(),
            studentId: String(studentId).trim(),
            firstName: String(firstName).trim(),
            middleName: String(middleName).trim(),
            lastName: String(lastName).trim(),
            email: String(email).trim(),
            program,
            course,
            year,
            createdAt: new Date().toISOString()
        };

        students.unshift(student);
        saveJson(DATA_FILE, students);

        res.status(201).json(student);

    } catch (error) {
        console.error("Add Student Error:", error);

        res.status(500).json({
            message: "Unable to add student."
        });
    }
});

// UPDATE STUDENT

app.put("/api/students/:id", (req, res) => {
    try {
        const students = readStudents();

        const index = students.findIndex(
            student => String(student.id) === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        const {
            studentId,
            firstName,
            middleName = "",
            lastName,
            email,
            program,
            course,
            year
        } = req.body;

        if (
            ![
                studentId,
                firstName,
                lastName,
                email,
                program,
                course,
                year
            ].every(value => String(value || "").trim())
        ) {
            return res.status(400).json({
                message: "Please complete all required fields."
            });
        }

        const normalizedId = String(studentId).trim().toLowerCase();
        const normalizedEmail = String(email).trim().toLowerCase();

        const duplicate = students.some((student, i) =>
            i !== index &&
            (
                String(student.studentId).toLowerCase() === normalizedId ||
                String(student.email).toLowerCase() === normalizedEmail
            )
        );

        if (duplicate) {
            return res.status(409).json({
                message: "Another student already uses that Student ID or email."
            });
        }

        students[index] = {
            ...students[index],
            studentId: String(studentId).trim(),
            firstName: String(firstName).trim(),
            middleName: String(middleName).trim(),
            lastName: String(lastName).trim(),
            email: String(email).trim(),
            program,
            course,
            year
        };

        saveJson(DATA_FILE, students);

        res.json(students[index]);

    } catch (error) {
        console.error("Update Student Error:", error);

        res.status(500).json({
            message: "Unable to update student."
        });
    }
});

// ==========================================
// STUDENT ARCHIVE
// ==========================================

// GET ARCHIVED STUDENTS

app.get("/api/students/archive", (req, res) => {
    try {
        const archived = readArchivedStudents();

        archived.sort((a, b) =>
            new Date(b.archivedAt || 0) -
            new Date(a.archivedAt || 0)
        );

        res.json(archived);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to retrieve archived students."
        });
    }
});

// ARCHIVE STUDENT INSTEAD OF PERMANENTLY DELETING

app.delete("/api/students/:id", (req, res) => {
    try {
        const students = readStudents();

        const student = students.find(
            s => String(s.id) === req.params.id
        );

        if (!student) {
            return res.status(404).json({
                message: "Student not found."
            });
        }

        const archived = readArchivedStudents();

        archived.unshift({
            ...student,
            archivedAt: new Date().toISOString()
        });

        const updatedStudents = students.filter(
            s => String(s.id) !== req.params.id
        );

        saveJson(ARCHIVE_FILE, archived);
        saveJson(DATA_FILE, updatedStudents);

        res.json({
            success: true,
            message: "Student moved to archive successfully."
        });

    } catch (error) {
        console.error("Archive Student Error:", error);

        res.status(500).json({
            message: "Unable to archive student."
        });
    }
});

// RESTORE ARCHIVED STUDENT

app.post("/api/students/:id/restore", (req, res) => {
    try {
        const archived = readArchivedStudents();

        const index = archived.findIndex(
            s => String(s.id) === req.params.id
        );

        if (index === -1) {
            return res.status(404).json({
                message: "Archived student not found."
            });
        }

        const student = archived[index];
        const students = readStudents();

        const duplicate = students.some(s =>
            String(s.studentId).toLowerCase() ===
                String(student.studentId).toLowerCase() ||
            String(s.email).toLowerCase() ===
                String(student.email).toLowerCase()
        );

        if (duplicate) {
            return res.status(409).json({
                message: "Cannot restore: another active student already uses this Student ID or email."
            });
        }

        const restored = { ...student };

        delete restored.archivedAt;

        students.unshift(restored);

        saveJson(DATA_FILE, students);

        saveJson(
            ARCHIVE_FILE,
            archived.filter(s => String(s.id) !== req.params.id)
        );

        res.json({
            success: true,
            message: "Student restored successfully.",
            student: restored
        });

    } catch (error) {
        console.error("Restore Student Error:", error);

        res.status(500).json({
            message: "Unable to restore student."
        });
    }
});

// PERMANENTLY DELETE ARCHIVED STUDENT

app.delete("/api/students/archive/:id", (req, res) => {
    try {
        const archived = readArchivedStudents();

        const updated = archived.filter(
            s => String(s.id) !== req.params.id
        );

        if (updated.length === archived.length) {
            return res.status(404).json({
                message: "Archived student not found."
            });
        }

        saveJson(ARCHIVE_FILE, updated);

        res.json({
            success: true,
            message: "Archived student permanently deleted."
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to permanently delete student."
        });
    }
});

// ==========================================
// EVENTS MANAGEMENT
// ==========================================

// GET EVENTS

app.get("/api/events", (req, res) => {
    try {
        const events = readEvents();

        events.sort((a, b) =>
            new Date(b.createdAt || 0) -
            new Date(a.createdAt || 0)
        );

        res.json(events);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Unable to retrieve events."
        });
    }
});

// ADD EVENT WITH IMAGE

app.post("/api/events", (req, res) => {
    upload.single("image")(req, res, error => {
        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        try {
            const {
                program,
                title,
                description = "",
                eventDate = ""
            } = req.body;

            if (!program || !title || !req.file) {
                return res.status(400).json({
                    message: "Program, event title, and event image are required."
                });
            }

            const events = readEvents();

            const event = {
                id: Date.now().toString(),
                program,
                title: title.trim(),
                description: description.trim(),
                eventDate,
                image: `/uploads/${req.file.filename}`,
                createdAt: new Date().toISOString()
            };

            events.unshift(event);

            saveJson(EVENTS_FILE, events);

            res.status(201).json(event);

        } catch (error) {
            console.error("Add Event Error:", error);

            if (req.file) {
                fs.unlink(req.file.path, () => {});
            }

            res.status(500).json({
                message: "Unable to add event."
            });
        }
    });
});

// DELETE EVENT
// Keep this route only if event deletion is required by your admin interface.

app.delete("/api/events/:id", (req, res) => {
    try {
        const events = readEvents();

        const event = events.find(
            e => String(e.id) === req.params.id
        );

        if (!event) {
            return res.status(404).json({
                message: "Event not found."
            });
        }

        const updatedEvents = events.filter(
            e => String(e.id) !== req.params.id
        );

        saveJson(EVENTS_FILE, updatedEvents);

        if (event.image && event.image.startsWith("/uploads/")) {
            const imagePath = path.join(
                UPLOAD_DIR,
                path.basename(event.image)
            );

            fs.unlink(imagePath, () => {});
        }

        res.json({
            success: true,
            message: "Event deleted."
        });

    } catch (error) {
        console.error("Delete Event Error:", error);

        res.status(500).json({
            message: "Unable to delete event."
        });
    }
});

// ==========================================
// UNKNOWN API ROUTES
// ==========================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found.",
        requestedUrl: req.originalUrl
    });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {
    console.error("Server Error:", error);

    res.status(500).json({
        success: false,
        message: "Server error. Please try again."
    });
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
    console.log(
        `Student Information System API running on port ${PORT}`
    );
});
