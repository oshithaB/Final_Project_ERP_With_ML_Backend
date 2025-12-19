const db = require("../DB/db");

const getCategories = async (req, res) => {
    try {
        const { company_id } = req.params;
        console.log('Get categories request received for company:', company_id);

        if (!company_id) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        const [categories] = await db.query(`
            SELECT * FROM product_categories WHERE company_id = ? AND is_active = 1 ORDER BY created_at DESC
        `, [company_id]);

        if (categories.length === 0) {
            return res.status(200).json(categories);
        }

        console.log('Categories fetched:', categories);

        return res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const createCategory = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { name } = req.body;
        
        console.log('Create category request received:', req.body);

        if (!company_id) {
            return res.status(400).json({ success: false, message: 'Company ID is required' });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        const name_lower = name.toLowerCase();

        // Check if category with same name exists in this company
        const [existingCategory] = await db.query(
            'SELECT * FROM product_categories WHERE name = ? AND company_id = ? AND is_active = 1',
            [name_lower, company_id]
        );

        if (existingCategory.length > 0) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists in this company' });
        }

        const [result] = await db.query(
            'INSERT INTO product_categories (name, company_id) VALUES (?, ?)',
            [
                name_lower,
                company_id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to create category' });
        }

        console.log('New category created:', result);

        return res.status(201).json({ success: true, message: 'Category created successfully' });

    } catch (error) {
        console.error('Error creating category:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const updateCategory = async (req, res) => {
    try {
        const { company_id, id } = req.params;
        const { name } = req.body;

        console.log('Update category request received:', req.body);

        if (!company_id || !id) {
            return res.status(400).json({ success: false, message: 'Company ID and Category ID are required' });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }

        // Check if category exists
        const [existingCategory] = await db.query(
            'SELECT * FROM product_categories WHERE id = ? AND company_id = ? AND is_active = 1', 
            [id, company_id]
        );

        if (existingCategory.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const name_lower = name.toLowerCase();

        // Check for name conflicts (excluding current category)
        const [nameConflict] = await db.query(
            'SELECT * FROM product_categories WHERE name = ? AND company_id = ? AND id != ?', 
            [name_lower, company_id, id]
        );

        if (nameConflict.length > 0) {
            return res.status(400).json({ success: false, message: 'Category with this name already exists in this company' });
        }

        const [result] = await db.query(
            'UPDATE product_categories SET name = ? WHERE id = ? AND company_id = ?',
            [
                name_lower, 
                id, 
                company_id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update category' });
        }

        console.log('Category updated:', result);

        return res.status(200).json({ 
            success: true, 
            message: 'Category updated successfully'
        });
    } catch (error) {
        console.error('Error updating category:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const deleteCategory = async(req, res) => {
    try {
        const { company_id, id } = req.params;
        console.log('Delete category request received for ID:', id, 'Company:', company_id);
        if (!company_id || !id) {
            return res.status(400).json({ success: false, message: 'Company ID and Category ID are required' });
        }
        const [existingCategory] = await db.query(
            'SELECT * FROM product_categories WHERE id = ? AND company_id = ? AND is_active = 1', 
            [id, company_id]
        );

        if (existingCategory.length === 0) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        const [result] = await db.query(
            'UPDATE product_categories SET is_active = 0 WHERE id = ? AND company_id = ?',
            [id, company_id]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to soft delete category' });
        }

        console.log('Category soft deleted successfully');

        return res.status(200).json({ success: true, message: 'Category soft deleted successfully' });
    } catch (error) {
        console.error('Error soft deleting category:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// const permanentDeleteCategory = async(req, res) => {
//     try {
//         const { company_id, id } = req.params;
        
//         console.log('Delete category request received for ID:', id, 'Company:', company_id);

//         if (!company_id || !id) {
//             return res.status(400).json({ success: false, message: 'Company ID and Category ID are required' });
//         }

//         const [existingCategory] = await db.query(
//             'SELECT * FROM product_categories WHERE id = ? AND company_id = ?', 
//             [id, company_id]
//         );

//         if (existingCategory.length === 0) {
//             return res.status(404).json({ success: false, message: 'Category not found' });
//         }
        
//         await db.query('DELETE FROM product_categories WHERE id = ? AND company_id = ?', [id, company_id]);
//         console.log('Category deleted successfully');

//         return res.status(200).json({ success: true, message: 'Category deleted successfully' });
//     } catch (error) {
//         console.error('Error deleting category:', error);
//         return res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// }

module.exports = {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory
};