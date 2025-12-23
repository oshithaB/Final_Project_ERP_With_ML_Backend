const db = require('../DB/db');

class ReportController {

    // Get Full Inventory Report
    // Returns current stock, cost, and stock status for all products
    static async getInventoryReport(req, res) {
        try {
            const { company_id } = req.params;

            if (!company_id) {
                return res.status(400).json({ success: false, message: 'Company ID is required' });
            }

            const [products] = await db.query(
                `SELECT 
                    p.id, 
                    p.sku, 
                    p.name, 
                    p.quantity_on_hand, 
                    p.cost_price, 
                    p.unit_price,
                    (p.quantity_on_hand * p.cost_price) as total_asset_value 
                 FROM products p 
                 WHERE p.company_id = ? AND p.is_active = TRUE
                 ORDER BY p.name ASC`,
                [company_id]
            );

            // Calculate totals
            const totalStockValue = products.reduce((sum, p) => sum + parseFloat(p.total_asset_value || 0), 0);
            const totalItems = products.reduce((sum, p) => sum + parseInt(p.quantity_on_hand || 0), 0);

            return res.status(200).json({
                success: true,
                data: products,
                summary: {
                    total_stock_value: totalStockValue,
                    total_items: totalItems,
                    generated_at: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Error getting inventory report:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }

    // Get Shrinkage/Adjustment Report
    // Returns list of manual adjustments (Shrinkage/Surplus)
    static async getShrinkageReport(req, res) {
        try {
            const { company_id } = req.params;
            const { start_date, end_date } = req.query;

            if (!company_id) {
                return res.status(400).json({ success: false, message: 'Company ID is required' });
            }

            let dateCondition = '';
            let params = [company_id];

            if (start_date && end_date) {
                dateCondition = 'AND ia.created_at BETWEEN ? AND ?';
                params.push(start_date, end_date);
            }

            const [adjustments] = await db.query(
                `SELECT 
                    ia.id,
                    ia.created_at,
                    p.name as product_name,
                    p.sku as product_sku,
                    ia.previous_quantity,
                    ia.new_quantity,
                    ia.adjustment_quantity,
                    ia.reason,
                    (ia.adjustment_quantity * p.cost_price) as adjustment_value
                 FROM inventory_adjustments ia
                 JOIN products p ON ia.product_id = p.id
                 WHERE ia.company_id = ? ${dateCondition}
                 ORDER BY ia.created_at DESC`,
                params
            );

            // Summary calculations
            const totalShrinkageValue = adjustments
                .filter(a => a.adjustment_quantity < 0)
                .reduce((sum, a) => sum + Math.abs(parseFloat(a.adjustment_value || 0)), 0);

            const totalSurplusValue = adjustments
                .filter(a => a.adjustment_quantity > 0)
                .reduce((sum, a) => sum + parseFloat(a.adjustment_value || 0), 0);

            return res.status(200).json({
                success: true,
                data: adjustments,
                summary: {
                    total_shrinkage_loss: totalShrinkageValue,
                    total_surplus_gain: totalSurplusValue,
                    net_adjustment_value: totalSurplusValue - totalShrinkageValue
                }
            });

        } catch (error) {
            console.error('Error getting shrinkage report:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
}

module.exports = ReportController;
