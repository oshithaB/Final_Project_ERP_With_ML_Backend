const db = require("../DB/db");
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure Product_Uploads directory exists
const uploadDir = path.join(__dirname, 'Product_Uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'Product_Uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only JPEG and PNG images are allowed'));
        }
    }
}).single('image');

const getProducts = async (req, res) => {
    try {
        const { company_id } = req.params;

        if (!company_id) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        const [products] = await db.query(
            `SELECT p.*, c.name as category_name, v.name as vendor_name, e.name as employee_name
             FROM products p
             LEFT JOIN product_categories c ON p.category_id = c.id
             LEFT JOIN vendor v ON p.preferred_vendor_id = v.vendor_id
             LEFT JOIN employees e ON p.added_employee_id = e.id
             WHERE p.company_id = ? ORDER BY p.created_at DESC`,
            [company_id]
        );

        return res.status(200).json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const createProduct = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ success: false, message: err.message || 'File upload error' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const { company_id } = req.params;
            const {
                sku,
                name,
                description,
                category_id,
                preferred_vendor_id,
                added_employee_id,
                unit_price,
                cost_price,
                quantity_on_hand,
                manual_count,
                reorder_level,
                order_quantity,
                commission,
                commission_type,
                commission_input
            } = req.body;
            const image = req.file ? `/Product_Uploads/${req.file.filename}` : null;

            // Input validations
            if (!company_id) {
                return res.status(400).json({ success: false, message: 'Company ID is required' });
            }

            if (!name || name.trim() === '') {
                return res.status(400).json({ success: false, message: 'Product name is required' });
            }

            // Validate commission
            let validatedCommission = null;
            if (commission !== undefined && commission !== null && commission !== '') {
                const commissionValue = parseFloat(commission);
                if (isNaN(commissionValue) || commissionValue < 0) {
                    return res.status(400).json({ success: false, message: 'Commission must be a positive number' });
                }
                validatedCommission = commissionValue;
            }

            // Validate commission_type
            const validatedCommissionType = commission_type && ['fixed', 'percentage'].includes(commission_type)
                ? commission_type
                : 'fixed';

            // Validate numeric fields
            const validatedUnitPrice = unit_price ? parseFloat(unit_price) : 0;
            const validatedCostPrice = cost_price ? parseFloat(cost_price) : 0;
            const validatedQuantity = quantity_on_hand ? parseInt(quantity_on_hand) : 0;
            const validateManualCount = (manual_count !== undefined && manual_count !== null && manual_count !== '') ? parseInt(manual_count) : null;
            const validatedReorderLevel = reorder_level ? parseInt(reorder_level) : 0;
            const validatedOrderQuantity = order_quantity ? parseInt(order_quantity) : 0;

            if (isNaN(validatedUnitPrice) || isNaN(validatedCostPrice) ||
                isNaN(validatedQuantity) || isNaN(validatedReorderLevel) ||
                (validateManualCount !== null && isNaN(validateManualCount)) || isNaN(validatedOrderQuantity)) {
                return res.status(400).json({ success: false, message: 'Invalid numeric values provided' });
            }

            // SKU uniqueness check removed as per user request
            /* 
            if (sku) {
                const [existingProduct] = await connection.query(
                    'SELECT * FROM products WHERE company_id = ? AND sku = ?',
                    [company_id, sku]
                );

                if (existingProduct.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Product with this SKU already exists' });
                }
            } 
            */

            // Validate referenced IDs using connection
            if (category_id) {
                const [category] = await connection.query('SELECT id FROM product_categories WHERE id = ? AND company_id = ?', [category_id, company_id]);
                if (category.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid category ID' });
                }
            }

            if (preferred_vendor_id) {
                const [vendor] = await connection.query('SELECT vendor_id FROM vendor WHERE vendor_id = ? AND company_id = ?', [preferred_vendor_id, company_id]);
                if (vendor.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
                }
            }

            if (added_employee_id) {
                const [employee] = await connection.query('SELECT id FROM employees WHERE id = ?', [added_employee_id]);
                if (employee.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid employee ID' });
                }
            }

            // Generate SKU if not provided
            let productSku = sku;
            if (!productSku) {
                const [lastProduct] = await connection.query(
                    'SELECT sku FROM products WHERE company_id = ? AND sku IS NOT NULL ORDER BY id DESC LIMIT 1',
                    [company_id]
                );

                let skuNumber = 1;
                if (lastProduct.length > 0 && lastProduct[0].sku) {
                    const lastSku = lastProduct[0].sku;
                    const lastNumber = parseInt(lastSku.replace('PRD', ''));
                    if (!isNaN(lastNumber)) {
                        skuNumber = lastNumber + 1;
                    }
                }
                productSku = `PRD${String(skuNumber).padStart(3, '0')}`;
            }

            // Insert Product
            const [result] = await connection.query(
                `INSERT INTO products (
                    company_id, sku, name, image, description, category_id, 
                    preferred_vendor_id, added_employee_id, unit_price, cost_price, 
                    quantity_on_hand, manual_count, reorder_level, order_quantity, 
                    commission, commission_type, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    company_id,
                    productSku,
                    name,
                    image,
                    description || null,
                    category_id || null,
                    preferred_vendor_id || null,
                    added_employee_id || null,
                    validatedUnitPrice,
                    validatedCostPrice,
                    validatedQuantity,
                    validateManualCount,
                    validatedReorderLevel,
                    validatedOrderQuantity,
                    validatedCommission,
                    validatedCommissionType,
                    true
                ]
            );

            const productId = result.insertId;

            // --- Handle Opening Stock Logic ---
            if (validatedQuantity > 0) {
                const orderNo = `OPENING-STK-${productId}-${Date.now()}`;
                const currentDate = new Date().toISOString().split('T')[0];

                // Create a system order for opening stock
                const [orderResult] = await connection.query(
                    `INSERT INTO orders (
                        company_id, vendor_id, order_no, order_date, 
                        total_amount, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        company_id,
                        preferred_vendor_id || null,
                        orderNo,
                        currentDate,
                        0, // Total amount is 0 for opening stock as it's already owned
                        'closed' // Closed because stock is already in hand
                    ]
                );

                const orderId = orderResult.insertId;

                // Create order item
                await connection.query(
                    `INSERT INTO order_items (
                        order_id, product_id, name, sku, description, 
                        qty, rate, amount, 
                        received, closed, remaining_qty, stock_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        productId,
                        name,
                        productSku,
                        'Opening Stock',
                        validatedQuantity,
                        validatedCostPrice,
                        0, // amount
                        true, // received
                        true, // closed
                        validatedQuantity, // remaining_qty
                        'in_stock'
                    ]
                );
            }

            await connection.commit();

            const productData = {
                id: productId,
                company_id: parseInt(company_id),
                sku: productSku,
                name,
                image,
                description: description || null,
                category_id: category_id ? parseInt(category_id) : null,
                preferred_vendor_id: preferred_vendor_id ? parseInt(preferred_vendor_id) : null,
                added_employee_id: added_employee_id ? parseInt(added_employee_id) : null,
                unit_price: validatedUnitPrice,
                cost_price: validatedCostPrice,
                quantity_on_hand: validatedQuantity,
                manual_count: validateManualCount,
                reorder_level: validatedReorderLevel,
                order_quantity: validatedOrderQuantity,
                commission: validatedCommission,
                commission_type: validatedCommissionType,
                is_active: true,
                created_at: new Date()
            };

            return res.status(201).json({
                success: true,
                message: 'Product created successfully',
                product: productData
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error creating product:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        } finally {
            connection.release();
        }
    });
};

const updateProduct = async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ success: false, message: err.message || 'File upload error' });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const { company_id, product_id } = req.params;
            const {
                sku,
                name,
                description,
                category_id,
                preferred_vendor_id,
                added_employee_id,
                unit_price,
                cost_price,
                quantity_on_hand,
                manual_count,
                reorder_level,
                order_quantity,
                commission,
                commission_type,
                commission_input,
                is_active
            } = req.body;
            const image = req.file ? `/Product_Uploads/${req.file.filename}` : req.body.image;

            if (!company_id || !product_id) {
                return res.status(400).json({ success: false, message: 'Company ID and Product ID are required' });
            }

            // Lock the product row for update
            const [existingProductRows] = await connection.query(
                'SELECT * FROM products WHERE id = ? AND company_id = ? FOR UPDATE',
                [product_id, company_id]
            );

            if (existingProductRows.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Product not found' });
            }

            const existingProduct = existingProductRows[0];

            // SKU uniqueness check removed as per user request
            /*
            if (sku) {
                const [skuConflict] = await connection.query(
                    'SELECT * FROM products WHERE company_id = ? AND sku = ? AND id != ?',
                    [company_id, sku, product_id]
                );

                if (skuConflict.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'SKU already in use by another product' });
                }
            }
            */

            // Validations for referenced IDs
            if (category_id) {
                const [category] = await connection.query('SELECT id FROM product_categories WHERE id = ? AND company_id = ?', [category_id, company_id]);
                if (category.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid category ID' });
                }
            }

            if (preferred_vendor_id) {
                const [vendor] = await connection.query('SELECT vendor_id FROM vendor WHERE vendor_id = ? AND company_id = ?', [preferred_vendor_id, company_id]);
                if (vendor.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid vendor ID' });
                }
            }

            if (added_employee_id) {
                const [employee] = await connection.query('SELECT id FROM employees WHERE id = ?', [added_employee_id]);
                if (employee.length === 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Invalid employee ID' });
                }
            }

            // --- INVENTORY LOGIC ---
            // 1. Check if there is any stock history for this product
            const [stockHistory] = await connection.query(
                `SELECT id FROM order_items WHERE product_id = ? LIMIT 1`,
                [product_id]
            );

            const hasStockHistory = stockHistory.length > 0;
            const currentQty = parseInt(existingProduct.quantity_on_hand || 0);
            const newQty = quantity_on_hand !== undefined ? parseInt(quantity_on_hand) : currentQty;
            const newCostPrice = cost_price !== undefined ? parseFloat(cost_price) : parseFloat(existingProduct.cost_price || 0);

            // Logic A: Deferred Opening Stock (No History AND New Qty > 0)
            if (!hasStockHistory && newQty > 0) {
                const orderNo = `OPENING-STK-${product_id}-${Date.now()}`;
                const currentDate = new Date().toISOString().split('T')[0];

                const [orderResult] = await connection.query(
                    `INSERT INTO orders (
                        company_id, vendor_id, order_no, order_date, 
                        total_amount, status, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        company_id,
                        preferred_vendor_id || existingProduct.preferred_vendor_id || null,
                        orderNo,
                        currentDate,
                        0,
                        'closed'
                    ]
                );
                const orderId = orderResult.insertId;

                await connection.query(
                    `INSERT INTO order_items (
                        order_id, product_id, name, sku, description, 
                        qty, rate, amount, 
                        received, closed, remaining_qty, stock_status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        product_id,
                        name || existingProduct.name,
                        sku || existingProduct.sku,
                        'Opening Stock',
                        newQty,
                        newCostPrice,
                        0,
                        true,
                        true,
                        newQty,
                        'in_stock'
                    ]
                );
            }
            // Logic B: Inventory Adjustment (History Exists AND Qty Changed)
            else if (hasStockHistory && newQty !== currentQty) {
                const diff = newQty - currentQty;

                // Log the adjustment
                await connection.query(
                    `INSERT INTO inventory_adjustments (
                        company_id, product_id, previous_quantity, new_quantity, adjustment_quantity, reason
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [company_id, product_id, currentQty, newQty, diff, diff > 0 ? 'Stock Adjustment - Surplus' : 'Stock Adjustment - Shrinkage']
                );

                if (diff > 0) {
                    // Surplus: Add new stock batch
                    const orderNo = `ADJ-IN-${product_id}-${Date.now()}`;
                    const currentDate = new Date().toISOString().split('T')[0];

                    const [orderResult] = await connection.query(
                        `INSERT INTO orders (
                            company_id, vendor_id, order_no, order_date, 
                            total_amount, status, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                        [company_id, null, orderNo, currentDate, 0, 'closed']
                    );

                    await connection.query(
                        `INSERT INTO order_items (
                            order_id, product_id, name, sku, description, 
                            qty, rate, amount, 
                            received, closed, remaining_qty, stock_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            orderResult.insertId,
                            product_id,
                            name || existingProduct.name,
                            sku || existingProduct.sku,
                            'Stock Adjustment - Surplus',
                            diff,
                            newCostPrice,
                            0,
                            true,
                            true,
                            diff,
                            'in_stock'
                        ]
                    );
                } else {
                    // Shrinkage: Reduce from existing batches (FIFO)
                    const absDiff = Math.abs(diff);
                    let qtyToReduce = absDiff;

                    const [availableBatches] = await connection.query(
                        `SELECT id, remaining_qty, stock_status FROM order_items 
                         WHERE product_id = ? AND stock_status = 'in_stock' 
                         ORDER BY created_at ASC`,
                        [product_id]
                    );

                    for (const batch of availableBatches) {
                        if (qtyToReduce <= 0) break;

                        if (batch.remaining_qty > qtyToReduce) {
                            // Partial reduction of this batch
                            await connection.query(
                                `UPDATE order_items SET remaining_qty = remaining_qty - ? WHERE id = ?`,
                                [qtyToReduce, batch.id]
                            );
                            qtyToReduce = 0;
                        } else {
                            // Consume entire batch
                            qtyToReduce -= batch.remaining_qty;
                            await connection.query(
                                `UPDATE order_items SET remaining_qty = 0, stock_status = 'out_of_stock' WHERE id = ?`,
                                [batch.id]
                            );
                        }
                    }

                    if (qtyToReduce > 0) {
                        // Warn: Data inconsistency (Actual stock < Database stock claim)
                        console.warn(`Shrinkage adjustment for product ${product_id} claimed ${absDiff} but only found stock for ${absDiff - qtyToReduce}. Database quantity will be forced to match.`);
                    }
                }
            }


            // --- NORMAL UPDATE ---
            const allowedFields = [
                'sku', 'name', 'image', 'description', 'category_id',
                'preferred_vendor_id', 'added_employee_id', 'unit_price',
                'cost_price', 'quantity_on_hand', 'manual_count', 'reorder_level',
                'order_quantity', 'commission', 'commission_type', 'is_active'
            ];

            const fieldsToUpdate = {};
            for (const key of allowedFields) {
                if (req.body[key] !== undefined) {
                    fieldsToUpdate[key] = req.body[key];
                }
            }
            if (image) fieldsToUpdate['image'] = image;

            if (Object.keys(fieldsToUpdate).length > 0) {
                const setClauses = [];
                const values = [];

                for (const key in fieldsToUpdate) {
                    setClauses.push(`${key} = ?`);
                    values.push(fieldsToUpdate[key]);
                }

                values.push(product_id, company_id);

                const updateQuery = `UPDATE products SET ${setClauses.join(', ')} WHERE id = ? AND company_id = ?`;
                await connection.query(updateQuery, values);
            }

            await connection.commit();

            return res.status(200).json({
                success: true,
                message: 'Product updated successfully'
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error updating product:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        } finally {
            connection.release();
        }
    });
};

const deleteProduct = async (req, res) => {
    try {
        const { company_id, product_id } = req.params;

        if (!company_id || !product_id) {
            return res.status(400).json({ success: false, message: 'Company ID and Product ID are required' });
        }

        const [existingProduct] = await db.query(
            'SELECT * FROM products WHERE id = ? AND company_id = ?',
            [product_id, company_id]
        );

        if (existingProduct.length === 0) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const [result] = await db.query(
            'DELETE FROM products WHERE id = ? AND company_id = ?',
            [product_id, company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(400).json({ success: false, message: 'Failed to delete product' });
        }

        return res.status(200).json({
            success: true,
            message: 'Product deleted successfully'
        });
    }

    catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCategories = async (req, res) => {
    try {
        const { company_id } = req.params;
        if (!company_id) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        const [categories] = await db.query(
            'SELECT id, name, is_active, created_at FROM product_categories WHERE company_id = ? ORDER BY name ASC',
            [company_id]
        );

        return res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getVendors = async (req, res) => {
    try {
        const { company_id } = req.params;
        if (!company_id) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        const [vendors] = await db.query(
            'SELECT vendor_id, name FROM vendor WHERE company_id = ? AND is_active = 1 ORDER BY name ASC',
            [company_id]
        );

        return res.status(200).json(vendors);
    } catch (error) {
        console.error('Error fetching vendors:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getEmployees = async (req, res) => {
    try {
        const [employees] = await db.query(
            'SELECT id, name FROM employees WHERE is_active = 1 ORDER BY name ASC'
        );

        return res.status(200).json(employees);
    } catch (error) {
        console.error('Error fetching employees:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const adjustStock = async (req, res) => {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const { company_id, product_id } = req.params;
        const { new_quantity, reason } = req.body;

        if (!company_id || !product_id) {
            return res.status(400).json({ success: false, message: 'Company ID and Product ID are required' });
        }

        if (new_quantity === undefined || new_quantity === null || isNaN(new_quantity)) {
            return res.status(400).json({ success: false, message: 'New quantity is required and must be a number' });
        }

        // Lock product row
        const [productRows] = await connection.query(
            'SELECT * FROM products WHERE id = ? AND company_id = ? FOR UPDATE',
            [product_id, company_id]
        );

        if (productRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existingProduct = productRows[0];
        const currentQty = parseInt(existingProduct.quantity_on_hand || 0);
        const targetQty = parseInt(new_quantity);
        const diff = targetQty - currentQty;

        if (diff === 0) {
            await connection.rollback();
            return res.json({ success: true, message: 'No change in quantity' });
        }

        // Update Product Quantity
        await connection.query(
            'UPDATE products SET quantity_on_hand = ? WHERE id = ?',
            [targetQty, product_id]
        );

        // Record in Inventory Adjustments
        await connection.query(
            `INSERT INTO inventory_adjustments (
                company_id, product_id, previous_quantity, new_quantity, adjustment_quantity, reason
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                company_id,
                product_id,
                currentQty,
                targetQty,
                diff,
                reason || 'Manual Adjustment' // Explicitly marks this type
            ]
        );

        // Update Order Items (FIFO Logic)
        if (diff > 0) {
            // Surplus: Create dummy "Stock Adjustment" order
            const orderNo = `ADJ-MANUAL-${product_id}-${Date.now()}`;
            const currentDate = new Date().toISOString().split('T')[0];

            const [orderResult] = await connection.query(
                `INSERT INTO orders (
                    company_id, vendor_id, order_no, order_date, 
                    total_amount, status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [company_id, null, orderNo, currentDate, 0, 'closed']
            );

            await connection.query(
                `INSERT INTO order_items (
                    order_id, product_id, name, sku, description, 
                    qty, rate, amount, 
                    received, closed, remaining_qty, stock_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    orderResult.insertId,
                    product_id,
                    existingProduct.name,
                    existingProduct.sku,
                    'Manual Stock Adjustment - Surplus',
                    diff,
                    existingProduct.cost_price, // Use current cost price
                    0,
                    true,
                    true,
                    diff,
                    'in_stock'
                ]
            );
        } else {
            // Shrinkage/Reduction: Reduce from existing batches
            let qtyToReduce = Math.abs(diff);

            const [availableBatches] = await connection.query(
                `SELECT id, remaining_qty FROM order_items 
                 WHERE product_id = ? AND stock_status = 'in_stock' 
                 ORDER BY created_at ASC`,
                [product_id]
            );

            for (const batch of availableBatches) {
                if (qtyToReduce <= 0) break;

                if (batch.remaining_qty > qtyToReduce) {
                    await connection.query(
                        `UPDATE order_items SET remaining_qty = remaining_qty - ? WHERE id = ?`,
                        [qtyToReduce, batch.id]
                    );
                    qtyToReduce = 0;
                } else {
                    qtyToReduce -= batch.remaining_qty;
                    await connection.query(
                        `UPDATE order_items SET remaining_qty = 0, stock_status = 'out_of_stock' WHERE id = ?`,
                        [batch.id]
                    );
                }
            }

            // If qtyToReduce > 0, it means we reduced more than we had traversing batches.
            // We accept this since we updated the main product quantity anyway.
        }

        await connection.commit();
        res.status(200).json({ success: true, message: 'Stock adjusted successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error adjusting stock:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        connection.release();
    }
};

module.exports = {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories,
    getVendors,
    getEmployees,
    adjustStock
};