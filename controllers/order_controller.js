const db = require('../DB/db');

// Fetch all orders for a company
const getOrders = async (req, res) => {
    const { companyId } = req.params;
    try {
        const [orders] = await db.execute(
            `SELECT o.id, v.name AS supplier, o.vendor_id, o.order_no, o.order_date, o.category_name AS category, o.class, o.location, o.total_amount, 
             o.subtotal, o.tax_amount, o.discount_type, o.discount_value, o.discount_amount, o.shipping_cost, o.notes, o.terms,
             o.status, o.created_at, o.mailling_address, o.email, o.customer_id, o.shipping_address, o.ship_via, e.name AS employee_name
             FROM orders o
             LEFT JOIN employees e ON o.class = e.id
             LEFT JOIN vendor v ON o.vendor_id = v.vendor_id
             WHERE o.company_id = ?
             AND o.order_no NOT LIKE 'BILL-STK%' 
             AND o.order_no NOT LIKE 'OPENING-STK%' 
             AND o.order_no NOT LIKE 'ADJ-IN%'
             ORDER BY o.created_at DESC`,
            [companyId]
        );
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
};

// Fetch a specific order
const getOrder = async (req, res) => {
    const { companyId, orderId } = req.params;
    try {
        const [order] = await db.execute(
            `SELECT o.id, v.name AS supplier, o.order_no, o.order_date, o.category_name AS category, o.class, o.location, o.total_amount, 
             o.subtotal, o.tax_amount, o.discount_type, o.discount_value, o.discount_amount, o.shipping_cost, o.notes, o.terms,
             o.status, o.created_at, o.mailling_address, o.email, o.customer_id, o.shipping_address, o.ship_via, e.name AS employee_name, o.vendor_id
         FROM orders o
         LEFT JOIN employees e ON o.class = e.id
         LEFT JOIN vendor v ON o.vendor_id = v.vendor_id
         WHERE o.company_id = ? AND o.id = ?`,
            [companyId, orderId]
        );
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.json(order[0]);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ message: 'Failed to fetch order' });
    }
};

// Fetch all order items for a company
const getOrderItems = async (req, res) => {
    const { companyId } = req.params;
    try {
        const [orderItems] = await db.execute(
            `SELECT oi.id, oi.order_id, oi.product_id, oi.name, oi.sku, oi.description, oi.qty, oi.rate, oi.amount, oi.class, oi.received, oi.closed, oi.tax_rate, oi.tax_amount, oi.created_at
             FROM order_items oi
             JOIN orders o ON oi.order_id = o.id
             WHERE o.company_id = ?`,
            [companyId]
        );
        res.json(orderItems);
    } catch (error) {
        console.error('Error fetching order items:', error);
        res.status(500).json({ message: 'Failed to fetch order items' });
    }
};

// Fetch all order items for a specific order in a company
const getOrderItemsByOrder = async (req, res) => {
    const { companyId, orderId } = req.params;
    try {
        const [order] = await db.execute(
            'SELECT id FROM orders WHERE id = ? AND company_id = ?',
            [orderId, companyId]
        );
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const [orderItems] = await db.execute(
            `SELECT oi.id, oi.order_id, oi.product_id, oi.name, oi.sku, oi.description, oi.qty, oi.rate, oi.amount, oi.class, oi.received, oi.closed, oi.tax_rate, oi.tax_amount, oi.created_at
             FROM order_items oi
             WHERE oi.order_id = ?`,
            [orderId]
        );
        res.json(orderItems);
    } catch (error) {
        console.error('Error fetching order items by order:', error);
        res.status(500).json({ message: 'Failed to fetch order items' });
    }
};

// Get order count for a company
const getOrderCount = async (req, res) => {
    const { companyId } = req.params;
    try {
        const [result] = await db.execute(
            'SELECT COUNT(*) as count FROM orders WHERE company_id = ?',
            [companyId]
        );
        res.json({ count: result[0].count });
    } catch (error) {
        console.error('Error fetching order count:', error);
        res.status(500).json({ message: 'Failed to fetch order count' });
    }
};

// Create a new order
const createOrder = async (req, res) => {
    const { companyId } = req.params;
    const {
        vendor_id, mailling_address, email, customer_id, shipping_address, order_no, order_date,
        category, class: orderClass, location, ship_via,
        subtotal, tax_amount, discount_type, discount_value, discount_amount, shipping_cost, notes, terms,
        total_amount, status
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
            `INSERT INTO orders (
                company_id, vendor_id, mailling_address, email, customer_id, shipping_address,
                order_no, order_date, category_name, class, location, ship_via, 
                subtotal, tax_amount, discount_type, discount_value, discount_amount, shipping_cost, notes, terms,
                total_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                companyId,
                vendor_id || null,
                mailling_address || null,
                email || null,
                customer_id || null,
                shipping_address || null,
                order_no,
                order_date,
                category || null,
                orderClass || null,
                location || null,
                ship_via || null,
                subtotal || 0,
                tax_amount || 0,
                discount_type || 'fixed',
                discount_value || 0,
                discount_amount || 0,
                shipping_cost || 0,
                notes || null,
                terms || null,
                total_amount || 0,
                status || 'open'
            ]
        );

        // Update vendor balance if vendor_id exists and status is 'open'
        // if (vendor_id && (status || 'open') === 'open') {
        //     await connection.execute(
        //         `UPDATE vendor SET balance = balance + ? WHERE vendor_id = ? AND company_id = ?`,
        //         [total_amount || 0, vendor_id, companyId]
        //     );
        // }

        await connection.commit();

        res.json({ id: result.insertId, message: 'Order created successfully' });
    } catch (error) {
        await connection.rollback();
        console.error('Error creating order:', error);
        res.status(500).json({ message: 'Failed to create order' });
    } finally {
        connection.release();
    }
};


// Update an existing order
const updateOrder = async (req, res) => {
    const { companyId, orderId } = req.params;
    const {
        vendor_id, mailling_address, email, customer_id, shipping_address, order_no, order_date,
        category, class: orderClass, location, ship_via,
        subtotal, tax_amount, discount_type, discount_value, discount_amount, shipping_cost, notes, terms,
        total_amount, status, items
    } = req.body;

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Check if order exists and fetch previous status, total_amount, and vendor_id
        const [order] = await connection.execute(
            'SELECT id, status, total_amount, vendor_id FROM orders WHERE id = ? AND company_id = ?',
            [orderId, companyId]
        );
        if (order.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        const previousStatus = order[0].status;
        const previousTotalAmount = order[0].total_amount || 0;
        const previousVendorId = order[0].vendor_id;

        // Update order details
        await connection.execute(
            `UPDATE orders SET
                vendor_id = ?, mailling_address = ?, email = ?, customer_id = ?, shipping_address = ?,
                order_no = ?, order_date = ?, category_name = ?, class = ?, location = ?, ship_via = ?,
                subtotal = ?, tax_amount = ?, discount_type = ?, discount_value = ?, discount_amount = ?, shipping_cost = ?, notes = ?, terms = ?,
                total_amount = ?, status = ?
             WHERE id = ? AND company_id = ?`,
            [
                vendor_id || null,
                mailling_address || null,
                email || null,
                customer_id || null,
                shipping_address || null,
                order_no,
                order_date,
                category || null,
                orderClass || null,
                location || null,
                ship_via || null,
                subtotal || 0,
                tax_amount || 0,
                discount_type || 'fixed',
                discount_value || 0,
                discount_amount || 0,
                shipping_cost || 0,
                notes || null,
                terms || null,
                total_amount || 0,
                status || 'open',
                orderId,
                companyId
            ]
        );

        await connection.execute(
            'DELETE FROM order_items WHERE order_id = ?',
            [orderId]
        );

        if (Array.isArray(items) && items.length > 0) {
            const insertPromises = items.map(item => {
                const {
                    product_id, name, sku, description, qty, rate, amount, class: itemClass, received, closed, tax_rate, tax_amount
                } = item;
                return connection.execute(
                    `INSERT INTO order_items (
                        order_id, product_id, name, sku, description, qty, rate, amount, class, received, closed, tax_rate, tax_amount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        orderId,
                        product_id || null,
                        name,
                        sku || null,
                        description || null,
                        qty,
                        rate,
                        amount || 0,
                        itemClass || null,
                        received || false,
                        closed || false,
                        tax_rate || 0,
                        tax_amount || 0
                    ]
                );
            });
            await Promise.all(insertPromises);
        }

        // Handle vendor balance updates
        // Apply the new status effect if there is a vendor
        if (vendor_id && status === 'closed') {
            await connection.execute(
                `UPDATE vendor SET balance = balance + ? WHERE vendor_id = ? AND company_id = ?`,
                [total_amount || 0, vendor_id, companyId]
            );
        }

        // Update product quantity in inventory if status is 'closed'
        // Stock update logic moved to Bill creation as per user request
        /*
        if (status === 'closed') {
            const [orderItems] = await connection.execute(
                'SELECT product_id, qty, rate FROM order_items WHERE order_id = ?',
                [orderId]
            );

            for (const item of orderItems) {
                await connection.execute(
                    'UPDATE products SET quantity_on_hand = quantity_on_hand + ?, cost_price = ? WHERE id = ? AND company_id = ?',
                    [item.qty, item.rate, item.product_id, companyId]
                );
            }

            await connection.execute(
                'UPDATE order_items SET remaining_qty = qty, stock_status = ? WHERE order_id = ?',
                ['in_stock', orderId]
            );
        }
        */

        await connection.commit();
        res.json({ message: 'Order updated successfully' });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating order:', error);
        res.status(500).json({ message: 'Failed to update order' });
    } finally {
        connection.release();
    }
};

// Create a new order item
const createOrderItem = async (req, res) => {
    const { companyId } = req.params;
    const { order_id, product_id, name, sku, description, qty, rate, amount, class: itemClass, received, closed, tax_rate, tax_amount } = req.body;

    try {
        const [order] = await db.execute(
            'SELECT id FROM orders WHERE id = ? AND company_id = ?',
            [order_id, companyId]
        );
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const [result] = await db.execute(
            `INSERT INTO order_items (
                order_id, product_id, name, sku, description, qty, rate, amount, class, received, closed, tax_rate, tax_amount
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order_id,
                product_id || null,
                name,
                sku || null,
                description || null,
                qty,
                rate,
                amount || 0,
                itemClass || null,
                received || false,
                closed || false,
                tax_rate || 0,
                tax_amount || 0
            ]
        );
        res.json({ id: result.insertId, message: 'Order item created successfully' });
    } catch (error) {
        console.error('Error creating order item:', error);
        res.status(500).json({ message: 'Failed to create order item' });
    }
};

// Delete an order
const deleteOrder = async (req, res) => {
    const { companyId, orderId } = req.params;
    try {
        const [order] = await db.execute(
            'SELECT id FROM orders WHERE id = ? AND company_id = ?',
            [orderId, companyId]
        );
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await db.execute('DELETE FROM orders WHERE id = ?', [orderId]);
        res.json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order' });
    }
};

// Delete order items for an order
const deleteOrderItems = async (req, res) => {
    const { companyId, orderId } = req.params;
    try {
        const [order] = await db.execute(
            'SELECT id FROM orders WHERE id = ? AND company_id = ?',
            [orderId, companyId]
        );
        if (order.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await db.execute('DELETE FROM order_items WHERE order_id = ?', [orderId]);
        res.json({ message: 'Order items deleted successfully' });
    } catch (error) {
        console.error('Error deleting order items:', error);
        res.status(500).json({ message: 'Failed to delete order items' });
    }
};

// Get purchase statistics for a company
const getPurchaseStats = async (req, res) => {
    const { companyId } = req.params;
    try {
        // Query for Total Purchases (sum of total_amount)
        const [totalPurchasesResult] = await db.execute(
            'SELECT SUM(total_amount) as total_purchases FROM orders WHERE company_id = ?',
            [companyId]
        );

        // Query for Purchase Orders count
        const [purchaseOrdersResult] = await db.execute(
            'SELECT COUNT(*) as count FROM orders WHERE company_id = ?',
            [companyId]
        );

        // Query for Vendors count (distinct vendors)
        const [vendorsResult] = await db.execute(
            'SELECT COUNT(DISTINCT vendor_id) as count FROM orders WHERE company_id = ? AND vendor_id IS NOT NULL',
            [companyId]
        );

        // Query for Average Cost (average of total_amount for non-zero orders)
        const [avgCostResult] = await db.execute(
            'SELECT AVG(total_amount) as avg_cost FROM orders WHERE company_id = ? AND total_amount > 0',
            [companyId]
        );

        res.json({
            totalPurchases: totalPurchasesResult[0].total_purchases || 0,
            purchaseOrders: purchaseOrdersResult[0].count || 0,
            vendors: vendorsResult[0].count || 0,
            avgCost: avgCostResult[0].avg_cost || 0
        });
    } catch (error) {
        console.error('Error fetching purchase stats:', error);
        res.status(500).json({ message: 'Failed to fetch purchase statistics' });
    }
};

module.exports = {
    getOrders,
    getOrder,
    getOrderItems,
    getOrderCount,
    createOrder,
    updateOrder,
    createOrderItem,
    deleteOrder,
    deleteOrderItems,
    getPurchaseStats,
    getOrderItemsByOrder
};