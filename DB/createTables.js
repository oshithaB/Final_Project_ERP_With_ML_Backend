const bcrypt = require('bcrypt');

const createTables = async (db) => {
    await db.query("SET default_storage_engine=InnoDB;");
    const tables = [
        `CREATE TABLE IF NOT EXISTS company (
            company_id int NOT NULL AUTO_INCREMENT,
            name varchar(200) NOT NULL,
            is_taxable tinyint(1) NOT NULL DEFAULT '0',
            tax_number varchar(100) DEFAULT NULL,
            company_logo varchar(255) DEFAULT NULL,
            address text,
            contact_number varchar(20) DEFAULT '',
            email_address varchar(255) DEFAULT NULL,
            registration_number varchar(100) NOT NULL,
            terms_and_conditions text,
            notes text,
            opening_balance DECIMAL(15, 2) DEFAULT 0.00,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (company_id),
            UNIQUE KEY unique_registration_number (registration_number)
        )`,


        `CREATE TABLE IF NOT EXISTS role (
            role_id int NOT NULL AUTO_INCREMENT,
            name varchar(100) NOT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (role_id)
        )`,

        `CREATE TABLE IF NOT EXISTS employees (
            id int NOT NULL AUTO_INCREMENT,
            name varchar(200) NOT NULL,
            email varchar(150),
            phone varchar(20),
            address text,
            hire_date varchar(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY email (email)
        )`,

        `CREATE TABLE IF NOT EXISTS tax_rates (
            tax_rate_id INT AUTO_INCREMENT PRIMARY KEY,
            company_id int NOT NULL,
            name VARCHAR(100) NOT NULL,
            rate DECIMAL(10,5) NOT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            CONSTRAINT tax_rates_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS user (
            user_id int NOT NULL AUTO_INCREMENT,
            role_id int NOT NULL,
            full_name varchar(200) NOT NULL,
            username varchar(100) DEFAULT NULL,
            email varchar(150) NOT NULL,
            password_hash varchar(255) DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
            otp_code varchar(10) DEFAULT NULL,
            otp_expiry datetime DEFAULT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            is_fixed_to_company BOOLEAN DEFAULT FALSE,
            fixed_company_id INT DEFAULT NULL,
            PRIMARY KEY (user_id),
            UNIQUE KEY email (email),
            UNIQUE KEY username (username),
            KEY role_id (role_id),
            KEY fixed_company_id (fixed_company_id),
            CONSTRAINT user_ibfk_1 FOREIGN KEY (role_id) REFERENCES role (role_id),
            CONSTRAINT user_ibfk_2 FOREIGN KEY (fixed_company_id) REFERENCES company (company_id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS customer (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(255),
            email VARCHAR(255),
            is_taxable BOOLEAN DEFAULT FALSE,
            tax_number VARCHAR(100),
            phone VARCHAR(50),
            vehicle_number VARCHAR(100),
            credit_limit DECIMAL(12, 2) DEFAULT 0.00,
            current_balance DECIMAL(12, 2) DEFAULT 0.00,
            billing_address VARCHAR(255),
            billing_city VARCHAR(100),
            billing_province VARCHAR(100),
            billing_postal_code VARCHAR(20),
            billing_country VARCHAR(100),
            shipping_same_as_billing BOOLEAN DEFAULT FALSE,
            shipping_address VARCHAR(255),
            shipping_city VARCHAR(100),
            shipping_province VARCHAR(100),
            shipping_postal_code VARCHAR(20),
            shipping_country VARCHAR(100),
            primary_payment_method VARCHAR(100),
            terms VARCHAR(100),
            delivery_option VARCHAR(100),
            invoice_language VARCHAR(100),
            sales_tax_registration VARCHAR(100),
            opening_balance DECIMAL(12, 2) DEFAULT 0.00,
            is_active BOOLEAN DEFAULT TRUE,
            as_of_date varchar(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS vendor (
            vendor_id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT,
            name VARCHAR(255) NOT NULL,
            vendor_company_name VARCHAR(255) NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(100),
            zip_code VARCHAR(20),
            country VARCHAR(100),
            tax_number VARCHAR(100),
            fax_number VARCHAR(50),
            website VARCHAR(255),
            terms VARCHAR(255),
            account_number VARCHAR(100),
            balance DECIMAL(15, 2) DEFAULT 0,
            as_of_date varchar(255),
            vehicle_number varchar(50),
            billing_rate DECIMAL(10, 2) DEFAULT 0.00,
            default_expense_category VARCHAR(255),
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            CONSTRAINT vendor_ibfk_1 FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS product_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS payment_methods (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        )`,

        `CREATE TABLE IF NOT EXISTS deposit_to (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE
        )`,

        `CREATE TABLE IF NOT EXISTS account_type (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            account_type_name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS detail_type (
            id INT AUTO_INCREMENT PRIMARY KEY,
            detail_type_name VARCHAR(100) NOT NULL UNIQUE,
            account_type_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_type_id) REFERENCES account_type(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS payment_account (
            id INT AUTO_INCREMENT PRIMARY KEY,
            payment_account_name VARCHAR(100) NOT NULL,
            account_type_id INT NOT NULL,
            detail_type_id INT NOT NULL,
            company_id INT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (account_type_id) REFERENCES account_type(id),
            FOREIGN KEY (detail_type_id) REFERENCES detail_type(id),
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS expense_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_name VARCHAR(100) NOT NULL,
            company_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS payees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS products (
            id int NOT NULL AUTO_INCREMENT,
            company_id int NOT NULL,
            sku varchar(100),
            name varchar(200) NOT NULL,
            image varchar(255),
            description text,
            category_id int,
            preferred_vendor_id int,
            added_employee_id int,
            unit_price decimal(15,4) DEFAULT 0,
            cost_price decimal(15,4) DEFAULT 0,
            quantity_on_hand int DEFAULT 0,
            manual_count int DEFAULT NULL,
            reorder_level int DEFAULT 0,
            order_quantity int DEFAULT 0,
            commission decimal(10,2) DEFAULT 0.00,
            commission_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
            is_active BOOLEAN DEFAULT TRUE,
            created_at timestamp DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY company_id (company_id),
            KEY category_id (category_id),
            KEY preferred_vendor_id (preferred_vendor_id),
            KEY added_employee_id (added_employee_id),
            CONSTRAINT products_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE,
            CONSTRAINT products_ibfk_2 FOREIGN KEY (category_id) REFERENCES product_categories (id) ON DELETE SET NULL,
            CONSTRAINT products_ibfk_3 FOREIGN KEY (preferred_vendor_id) REFERENCES vendor (vendor_id) ON DELETE SET NULL,
            CONSTRAINT products_ibfk_4 FOREIGN KEY (added_employee_id) REFERENCES employees (id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            vendor_id INT,
            mailling_address TEXT,
            email VARCHAR(255),
            customer_id INT,
            shipping_address TEXT,
            order_no VARCHAR(100) NOT NULL,
            order_date DATE NOT NULL,
            category_name VARCHAR(100),
            class VARCHAR(100),
            location VARCHAR(100),
            ship_via VARCHAR(100),
            total_amount DECIMAL(15,2) DEFAULT 0.00,
            status ENUM('open', 'closed') DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            KEY vendor_id (vendor_id),
            KEY customer_id (customer_id),
            CONSTRAINT orders_ibfk_1 FOREIGN KEY (company_id) REFERENCES company (company_id) ON DELETE CASCADE,
            CONSTRAINT orders_ibfk_2 FOREIGN KEY (vendor_id) REFERENCES vendor (vendor_id) ON DELETE SET NULL,
            CONSTRAINT orders_ibfk_3 FOREIGN KEY (customer_id) REFERENCES customer (id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS estimates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estimate_number VARCHAR(100) NOT NULL UNIQUE,
            company_id INT NOT NULL,
            customer_id INT NOT NULL,
            employee_id INT,
            estimate_date VARCHAR(255) NOT NULL,
            expiry_date VARCHAR(255),
            head_note TEXT,
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            discount_type ENUM('percentage', 'fixed') NOT NULL,
            discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            status ENUM('pending', 'accepted', 'declined', 'closed', 'converted') NOT NULL DEFAULT 'pending',
            is_active BOOLEAN DEFAULT TRUE,
            notes TEXT,
            terms TEXT,
            shipping_address VARCHAR(255),
            billing_address VARCHAR(255),
            ship_via VARCHAR(100),
            shipping_date VARCHAR(255),
            tracking_number VARCHAR(100),
            invoice_id INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY company_id (company_id),
            KEY customer_id (customer_id),
            KEY employee_id (employee_id),
            KEY invoice_id (invoice_id),
            CONSTRAINT estimates_ibfk_1 FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
            CONSTRAINT estimates_ibfk_2 FOREIGN KEY (customer_id) REFERENCES customer(id),
            CONSTRAINT estimates_ibfk_3 FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
        );`,

        `CREATE TABLE IF NOT EXISTS invoices (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            customer_id INT NOT NULL,
            employee_id INT,
            estimate_id INT,
            invoice_number VARCHAR(50) NOT NULL UNIQUE,
            head_note TEXT,
            invoice_date VARCHAR(255) NOT NULL,
            due_date VARCHAR(255),
            discount_type ENUM('percentage', 'fixed') DEFAULT 'fixed',
            discount_value DECIMAL(10,2) DEFAULT 0.00,
            shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            notes TEXT,
            terms TEXT,
            shipping_address TEXT,
            billing_address TEXT,
            ship_via VARCHAR(100),
            shipping_date VARCHAR(255),
            tracking_number VARCHAR(100),
            subtotal DECIMAL(10,2) NOT NULL,
            tax_amount DECIMAL(10,2) DEFAULT 0.00,
            discount_amount DECIMAL(10,2) DEFAULT 0.00,
            total_amount DECIMAL(10,2) NOT NULL,
            paid_amount DECIMAL(15,2) DEFAULT 0.00,
            balance_due DECIMAL(15,2) DEFAULT 0.00,
            status ENUM('opened', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'proforma') DEFAULT 'opened',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id),
            FOREIGN KEY (customer_id) REFERENCES customer(id),
            FOREIGN KEY (employee_id) REFERENCES employees(id),
            FOREIGN KEY (estimate_id) REFERENCES estimates(id)
        );`,

        `CREATE TABLE IF NOT EXISTS estimate_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            estimate_id INT NOT NULL,
            product_id INT NOT NULL,
            description TEXT NOT NULL,
            quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
            unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            actual_unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            tax_rate DECIMAL(10,5) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (estimate_id) REFERENCES estimates(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`,

        `CREATE TABLE  IF NOT EXISTS invoice_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            product_id INT,
            product_name VARCHAR(255),
            description TEXT NOT NULL,
            quantity DECIMAL(10,2) NOT NULL,
            unit_price DECIMAL(15,4) NOT NULL,
            cost_price DECIMAL(15,4) DEFAULT 0,
            actual_unit_price DECIMAL(15,4) NOT NULL,
            tax_rate DECIMAL(10,5) NOT NULL,
            tax_amount DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            stock_detail JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id),
            FOREIGN KEY (product_id) REFERENCES products(id)
        )`,

        `CREATE TABLE IF NOT EXISTS invoice_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            invoice_id INT NOT NULL,
            file_path VARCHAR(255) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )`,

        `CREATE TABLE IF NOT EXISTS payments (
            id int(11) NOT NULL AUTO_INCREMENT,
            invoice_id int(11) NOT NULL,
            customer_id int(11) NOT NULL,
            company_id int(11) NOT NULL,
            payment_amount decimal(10,2) NOT NULL,
            payment_date date NOT NULL,
            payment_method varchar(50) NOT NULL,
            deposit_to varchar(100) NOT NULL,
            notes text DEFAULT NULL,
            created_at timestamp NOT NULL DEFAULT current_timestamp(),
            PRIMARY KEY (id),
            KEY invoice_id (invoice_id),
            KEY customer_id (customer_id),
            KEY company_id (company_id),
            CONSTRAINT payments_ibfk_1 FOREIGN KEY (invoice_id) REFERENCES invoices (id),
            CONSTRAINT payments_ibfk_2 FOREIGN KEY (customer_id) REFERENCES customer (id),
            CONSTRAINT payments_ibfk_3 FOREIGN KEY (company_id) REFERENCES company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;`,

        `CREATE TABLE IF NOT EXISTS cheques (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            cheque_number VARCHAR(50) NOT NULL UNIQUE,
            bank_name VARCHAR(100),
            branch_name VARCHAR(100),
            cheque_date VARCHAR(150),
            payee_name VARCHAR(255),
            amount DECIMAL(15,2) NOT NULL,
            status ENUM('pending', 'deposited', 'returned') DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS bills (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            bill_number VARCHAR(100) NOT NULL UNIQUE,
            order_id INT DEFAULT NULL,
            vendor_id INT NOT NULL,
            employee_id INT,
            bill_date DATE NOT NULL,
            due_date DATE NOT NULL,
            payment_method_id INT NOT NULL,
            notes TEXT,
            status ENUM('opened', 'cancelled', 'paid', 'partially_paid', 'overdue') DEFAULT 'opened',
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            paid_amount DECIMAL(15,2) DEFAULT 0.00,
            balance_due DECIMAL(15,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
            FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
            FOREIGN KEY (vendor_id) REFERENCES vendor(vendor_id),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        );`,

        `CREATE TABLE IF NOT EXISTS bill_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bill_id INT NOT NULL,
            product_id INT NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            description TEXT,
            quantity INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
            total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
        );`,

        `CREATE TABLE IF NOT EXISTS bill_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            bill_id INT NOT NULL,
            vendor_id INT NOT NULL,
            company_id INT NOT NULL,
            payment_date DATE NOT NULL,
            payment_amount DECIMAL(10,2) NOT NULL,
            payment_method VARCHAR(50) NOT NULL,
            deposit_to VARCHAR(100),
            notes TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
            FOREIGN KEY (vendor_id) REFERENCES vendor(vendor_id),
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS expenses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            expense_number VARCHAR(100) NOT NULL UNIQUE,
            payee_id INT NOT NULL,
            payment_account_id INT,
            payment_date DATE NOT NULL,
            payment_method_id INT NOT NULL,
            amount DECIMAL(15,2) NOT NULL,
            notes TEXT,
            status ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (payment_account_id) REFERENCES payment_account(id),
            FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id),
            FOREIGN KEY (payee_id) REFERENCES payees(id),
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS expense_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            expense_id INT NOT NULL,
            category_id INT NOT NULL,
            description TEXT,
            amount DECIMAL(15,2) NOT NULL,
            FOREIGN KEY (expense_id) REFERENCES expenses(id),
            FOREIGN KEY (category_id) REFERENCES expense_categories(id)
        )`,

        `CREATE TABLE IF NOT EXISTS payment_methods (
            id INT NOT NULL AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY name (name)
        )`,

        `CREATE TABLE IF NOT EXISTS order_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id INT NOT NULL,
            product_id INT,
            name VARCHAR(200) NOT NULL,
            sku VARCHAR(100),
            description TEXT,
            qty INT NOT NULL,
            rate DECIMAL(15,4) NOT NULL,
            amount DECIMAL(15,2) DEFAULT 0.00,
            class VARCHAR(100),
            received BOOLEAN DEFAULT FALSE,
            closed BOOLEAN DEFAULT FALSE,
            remaining_qty INT DEFAULT 0,
            stock_status ENUM('not_tracked', 'in_stock', 'out_of_stock') DEFAULT 'not_tracked',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY order_id (order_id),
            KEY product_id (product_id),
            CONSTRAINT order_items_ibfk_1 FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
            CONSTRAINT order_items_ibfk_2 FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS inventory_adjustments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            product_id INT NOT NULL,
            user_id INT, 
            previous_quantity INT NOT NULL,
            new_quantity INT NOT NULL,
            adjustment_quantity INT NOT NULL, 
            reason VARCHAR(255) DEFAULT 'Manual Adjustment',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )`,

    ];

    for (const table of tables) {
        try {
            await db.execute(table);
        } catch (error) {
            console.error('Error creating table:', table.substring(0, 50), error.message);
        }
    }

    // Check and add opening_balance column to company table if it doesn't exist
    try {
        const [columns] = await db.execute("SHOW COLUMNS FROM company LIKE 'opening_balance'");
        if (columns.length === 0) {
            console.log('Adding opening_balance column to company table...');
            await db.execute("ALTER TABLE company ADD COLUMN opening_balance DECIMAL(15, 2) DEFAULT 0.00 AFTER notes");
            console.log('opening_balance column added successfully.');
        }
    } catch (error) {
        console.error('Error checking/adding opening_balance column:', error);
    }

    // --- MIGRATION FOR TAX PRECISION ---
    try {
        console.log('Checking and updating tax precision to DECIMAL(10,5)...');
        await db.execute("ALTER TABLE tax_rates MODIFY COLUMN rate DECIMAL(10,5) NOT NULL");
        await db.execute("ALTER TABLE estimate_items MODIFY COLUMN tax_rate DECIMAL(10,5) NOT NULL DEFAULT 0.00000");
        await db.execute("ALTER TABLE invoice_items MODIFY COLUMN tax_rate DECIMAL(10,5) NOT NULL");
        console.log('Tax precision updated successfully.');
    } catch (error) {
        // Ignore error if columns already modified or tables don't exist (though they should)
        console.warn('Migration for tax precision warning (safe to ignore if already updated):', error.message);
    }

    // --- MIGRATION FOR FIXED EMPLOYEE ---
    try {
        console.log('Checking and updating user table for fixed employee columns...');
        const [columns] = await db.execute("SHOW COLUMNS FROM user LIKE 'is_fixed_to_company'");
        if (columns.length === 0) {
            await db.execute("ALTER TABLE user ADD COLUMN is_fixed_to_company BOOLEAN DEFAULT FALSE");
            await db.execute("ALTER TABLE user ADD COLUMN fixed_company_id INT DEFAULT NULL");
            await db.execute("ALTER TABLE user ADD CONSTRAINT fk_user_fixed_company FOREIGN KEY (fixed_company_id) REFERENCES company(company_id) ON DELETE SET NULL");
            console.log('User table updated with fixed employee columns.');
        }
    } catch (error) {
        console.warn('Migration for fixed employee warning:', error.message);
    }

    // --- MIGRATION FOR UNIQUE INVOICE NUMBER PER COMPANY ---
    try {
        console.log('Checking and updating unique constraint for invoice_number...');
        // Drop the existing unique index on invoice_number if it exists
        try {
            // We need to know the index name. Usually it's 'invoice_number'
            await db.execute("ALTER TABLE invoices DROP INDEX invoice_number");
            console.log("Dropped global unique index on invoice_number");
        } catch (e) {
            // Ignore if index doesn't exist
            // console.log("Index drop ignored or failed (might not exist):", e.message);
        }

        // Add composite unique index
        try {
            // Check if composite index already exists
            const [indexes] = await db.execute("SHOW INDEX FROM invoices WHERE Key_name = 'unique_invoice_per_company'");
            if (indexes.length === 0) {
                await db.execute("ALTER TABLE invoices ADD UNIQUE INDEX unique_invoice_per_company (company_id, invoice_number)");
                console.log("Added composite unique index (company_id, invoice_number)");
            }
        } catch (e) {
            console.warn("Error adding unique_invoice_per_company index:", e.message);
        }
    } catch (error) {
        console.warn('Migration for unique invoice number warning:', error.message);
    }

    const refundTables = [
        `CREATE TABLE IF NOT EXISTS refunds (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            invoice_id INT NOT NULL,
            refund_number VARCHAR(50) NOT NULL UNIQUE,
            refund_date VARCHAR(255) NOT NULL,
            reason TEXT,
            subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id)
        )`,
        `CREATE TABLE IF NOT EXISTS refund_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            refund_id INT NOT NULL,
            product_id INT,
            product_name VARCHAR(255),
            description TEXT,
            quantity DECIMAL(10,2) NOT NULL,
            unit_price DECIMAL(15,4) NOT NULL,
            tax_rate DECIMAL(10,5) NOT NULL DEFAULT 0.00,
            tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            total_price DECIMAL(15,2) NOT NULL DEFAULT 0.00,
            FOREIGN KEY (refund_id) REFERENCES refunds(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
        )`
    ];

    for (const table of refundTables) {
        try {
            await db.execute(table);
        } catch (error) {
            console.error('Error creating refund table:', error);
        }
    }

    // --- MIGRATION FOR REFUND NUMBERING ---
    try {
        console.log('Checking and updating company table for refund numbering...');
        const [columns] = await db.execute("SHOW COLUMNS FROM company LIKE 'refund_prefix'");
        if (columns.length === 0) {
            await db.execute("ALTER TABLE company ADD COLUMN refund_prefix VARCHAR(10) DEFAULT 'REF'");
            await db.execute("ALTER TABLE company ADD COLUMN current_refund_number INT DEFAULT 0");
            console.log('Company table updated with refund numbering columns.');
        }
    } catch (error) {
        console.error('Migration for refund numbering failed:', error);
    }

    // --- MIGRATION FOR OPTIONAL BILL PAYMENT METHOD ---
    try {
        console.log('Checking and updating bills table for optional payment method...');

        // Dynamically find and drop the Foreign Key on payment_method_id
        const [fks] = await db.execute(`
            SELECT CONSTRAINT_NAME 
            FROM information_schema.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'bills' 
            AND COLUMN_NAME = 'payment_method_id' 
            AND TABLE_SCHEMA = DATABASE() 
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `);

        for (const fk of fks) {
            console.log(`Dropping FK constraint: ${fk.CONSTRAINT_NAME}`);
            await db.execute(`ALTER TABLE bills DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        }

        // Modify column to allow NULL
        await db.execute("ALTER TABLE bills MODIFY COLUMN payment_method_id INT NULL");
        console.log('bills table updated: payment_method_id is now nullable.');

        // Recreate the foreign key constraint (allowing NULL)
        try {
            // Check if index exists first to avoid duplicate errors if previously created
            const [indexes] = await db.execute("SHOW INDEX FROM bills WHERE Key_name = 'bills_payment_method_fk'");
            if (indexes.length === 0) {
                await db.execute("ALTER TABLE bills ADD CONSTRAINT bills_payment_method_fk FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)");
                console.log('Recreated foreign key constraint for payment_method_id');
            }
        } catch (e) {
            console.log('Note on recreating FK:', e.message);
        }

    } catch (error) {
        console.warn('Migration for optional bill payment method warning:', error.message);
    }

    // --- MIGRATION FOR FLEXIBLE BILL FIELDS ---
    try {
        console.log('Checking and updating bills table for flexible fields...');
        // Make bill_date, due_date, and bill_number nullable
        await db.execute("ALTER TABLE bills MODIFY COLUMN bill_date DATE NULL");
        await db.execute("ALTER TABLE bills MODIFY COLUMN due_date DATE NULL");
        await db.execute("ALTER TABLE bills MODIFY COLUMN bill_number VARCHAR(100) NULL");
        // Also ensure bill_number UNIQUE constraint allows NULLs or is handled. 
        // MySQL UNIQUE allows multiple NULLs.
        console.log('bills table updated: bill_date, due_date, and bill_number are now nullable.');
    } catch (error) {
        console.warn('Migration for flexible bill fields warning:', error.message);
    }

    // --- MIGRATION FOR ESTIMATE SEQUENCE ---
    try {
        console.log('Checking and updating company table for estimate sequence...');
        const [columns] = await db.execute("SHOW COLUMNS FROM company LIKE 'current_estimate_number'");
        if (columns.length === 0) {
            await db.execute("ALTER TABLE company ADD COLUMN current_estimate_number INT DEFAULT 0");
            console.log('company table updated: current_estimate_number column added.');
        } else {
            console.log('company table already has current_estimate_number.');
        }
    } catch (error) {
        console.warn('Migration for estimate sequence warning:', error.message);
    }

    // --- MIGRATION FOR INVOICE SEPARATORS ---
    try {
        console.log('Checking and updating company table for invoice separators...');
        const [columns] = await db.execute("SHOW COLUMNS FROM company LIKE 'invoice_separators'");
        if (columns.length === 0) {
            // Default to 1 (true) for backward compatibility with dashes
            await db.execute("ALTER TABLE company ADD COLUMN invoice_separators TINYINT(1) DEFAULT 1");
            console.log('company table updated: invoice_separators column added.');
        } else {
            console.log('company table already has invoice_separators.');
        }
    } catch (error) {
        console.warn('Migration for invoice separators warning:', error.message);
    }

    // --- MIGRATION FOR CUSTOM INVOICE NUMBERING ---
    try {
        console.log('Checking and updating company table for invoice numbering...');
        const [columns] = await db.execute("SHOW COLUMNS FROM company LIKE 'invoice_prefix'");
        if (columns.length === 0) {
            await db.execute("ALTER TABLE company ADD COLUMN invoice_prefix VARCHAR(10) DEFAULT 'INV'");
            await db.execute("ALTER TABLE company ADD COLUMN current_invoice_number INT DEFAULT 0");
            console.log('Company table updated with invoice numbering columns.');
        }
    } catch (error) {
        console.error('Migration for invoice numbering failed:', error);
    }
    // --- UNIVERSAL SCHEMA FIX MIGRATIONS ---
    try {
        console.log('Starting Universal Schema Fix Migrations...');

        const migrations = [
            { table: 'products', column: 'cost_price', definition: 'DECIMAL(15,4) DEFAULT 0 AFTER unit_price' },
            { table: 'invoice_items', column: 'cost_price', definition: 'DECIMAL(15,4) DEFAULT 0 AFTER unit_price' },
            { table: 'invoice_items', column: 'actual_unit_price', definition: 'DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER cost_price' },
            { table: 'estimate_items', column: 'actual_unit_price', definition: 'DECIMAL(15,4) NOT NULL DEFAULT 0 AFTER unit_price' }
        ];

        for (const m of migrations) {
            const [columns] = await db.execute(`SHOW COLUMNS FROM ${m.table} LIKE '${m.column}'`);
            if (columns.length === 0) {
                console.log(`Migration: Adding ${m.column} to ${m.table}...`);
                await db.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
                console.log(`Success: ${m.column} added to ${m.table}.`);
            }
        }

        // Precision updates for existing columns
        const precisionUpdates = [
            { table: 'invoice_items', column: 'unit_price', definition: 'DECIMAL(15,4) NOT NULL' },
            { table: 'invoice_items', column: 'tax_rate', definition: 'DECIMAL(10,5) NOT NULL' },
            { table: 'estimate_items', column: 'unit_price', definition: 'DECIMAL(15,4) NOT NULL DEFAULT 0.0000' },
            { table: 'estimate_items', column: 'tax_rate', definition: 'DECIMAL(10,5) NOT NULL DEFAULT 0.00000' },
            { table: 'bill_items', column: 'unit_price', definition: 'DECIMAL(15,4) NOT NULL DEFAULT 0.0000' },
            { table: 'bill_items', column: 'quantity', definition: 'DECIMAL(10,2) NOT NULL DEFAULT 1.00' }
        ];

        for (const p of precisionUpdates) {
            console.log(`Migration: Updating precision for ${p.table}.${p.column}...`);
            await db.execute(`ALTER TABLE ${p.table} MODIFY COLUMN ${p.column} ${p.definition}`);
        }

        console.log('Universal Schema Fix Migrations completed.');
    } catch (error) {
        console.warn('Universal Schema Fix Migration warning:', error.message);
    }

    try {
        // Check existing roles
        const [existingRoles] = await db.execute('SELECT role_id, name FROM role WHERE name IN ("admin", "sale", "staff", "store_keeper")');
        console.log(`Found ${existingRoles.length} roles:`, existingRoles);

        if (existingRoles.length < 4) {
            // ... (rest of role creation logic)


            const roleMap = existingRoles.reduce((map, role) => {
                map[role.name] = role.role_id;
                return map;
            }, {});

            // Define expected roles
            const expectedRoles = ['admin', 'sale', 'staff', 'store_keeper'];
            const missingRoles = expectedRoles.filter(role => !roleMap[role]);

            if (missingRoles.length > 0) {
                console.log(`Missing roles: ${missingRoles.join(', ')}. Inserting...`);
                await db.beginTransaction();
                try {
                    // Insert missing roles
                    const placeholders = missingRoles.map(() => '(?)').join(', ');
                    const [roleResult] = await db.execute(
                        `INSERT INTO role (name) VALUES ${placeholders}`,
                        missingRoles
                    );
                    console.log(`Inserted ${roleResult.affectedRows} roles`);

                    // Refresh role map with newly inserted roles
                    const [roles] = await db.execute('SELECT role_id, name FROM role WHERE name IN ("admin", "sale", "staff")');
                    console.log('Fetched roles:', roles);

                    if (roles.length !== 3) {
                        throw new Error(`Expected 3 roles, but found ${roles.length}`);
                    }

                    roles.forEach(role => {
                        roleMap[role.name] = role.role_id;
                    });
                    console.log('Updated role map:', roleMap);

                    // Commit role insertion
                    await db.commit();
                } catch (error) {
                    await db.rollback();
                    console.error('Error inserting roles, transaction rolled back:', error);
                    throw error;
                }
            } else {
                console.log('All required roles (admin, sale, staff) already exist');
            }

            // Check if users exist
            const [existingUsers] = await db.execute('SELECT COUNT(*) as count FROM user');
            console.log(`User count in database: ${existingUsers[0].count}`);

            // Insert users regardless of existing users to ensure insertion
            console.log('Inserting default users...');
            await db.beginTransaction();
            try {
                const users = [
                    {
                        role_id: roleMap['admin'],
                        full_name: 'Aruna Kaldera',
                        username: 'Ansk02',
                        email: 'aruna.kaldera@example.com',
                        password: 'aK@123456'
                    },
                    {
                        role_id: roleMap['admin'],
                        full_name: 'Ramitha Heshan',
                        username: 'ramitha33',
                        email: 'ramithacampus@gmail.com',
                        password: 'test69'
                    },
                    {
                        role_id: roleMap['sale'],
                        full_name: 'Nimal Perera',
                        username: 'nimalP',
                        email: 'nimal.sales@example.com',
                        password: 'nP@123456'
                    },
                    {
                        role_id: roleMap['staff'],
                        full_name: 'Suneth Silva',
                        username: 'sunethS',
                        email: 'suneth.staff@example.com',
                        password: 'sS@789123'
                    }
                ];

                for (const user of users) {
                    if (!user.role_id) {
                        console.error(`Role ID for ${user.full_name} not found, skipping user insertion`);
                        continue;
                    }
                    // Check if user already exists by email or username
                    const [existingUser] = await db.execute(
                        'SELECT COUNT(*) as count FROM user WHERE email = ? OR username = ?',
                        [user.email, user.username]
                    );
                    if (existingUser[0].count > 0) {
                        console.log(`User with email ${user.email} or username ${user.username} already exists, skipping`);
                        continue;
                    }
                    const passwordHash = await bcrypt.hash(user.password, 10);
                    const [userResult] = await db.execute(
                        `INSERT INTO user (role_id, full_name, username, email, password_hash)
                    VALUES (?, ?, ?, ?, ?)`,
                        [user.role_id, user.full_name, user.username, user.email, passwordHash]
                    );
                    console.log(`Inserted user: ${user.email} (Role ID: ${user.role_id}, Affected Rows: ${userResult.affectedRows})`);
                }

                // Commit user insertion
                await db.commit();
                console.log('User insertion transaction committed successfully');
            } catch (error) {
                await db.rollback();
                console.error('Error inserting users, transaction rolled back:', error);
                throw error;
            }
        }
    } catch (error) {
        console.error('Error seeding roles:', error);
    }

    // --- MIGRATION FOR PURCHASE ORDER TAX/DISCOUNT ---
    try {
        console.log('Checking and updating orders table for tax/discount fields...');

        // fields to add to 'orders'
        const orderFields = [
            { name: 'subtotal', def: 'DECIMAL(15,2) DEFAULT 0.00' },
            { name: 'tax_amount', def: 'DECIMAL(15,2) DEFAULT 0.00' },
            { name: 'discount_type', def: "ENUM('percentage', 'fixed') DEFAULT 'fixed'" },
            { name: 'discount_value', def: 'DECIMAL(10,2) DEFAULT 0.00' },
            { name: 'discount_amount', def: 'DECIMAL(10,2) DEFAULT 0.00' },
            { name: 'shipping_cost', def: 'DECIMAL(15,2) DEFAULT 0.00' },
            { name: 'notes', def: 'TEXT' },
            { name: 'terms', def: 'TEXT' }
        ];

        for (const field of orderFields) {
            const [columns] = await db.execute(`SHOW COLUMNS FROM orders LIKE '${field.name}'`);
            if (columns.length === 0) {
                await db.execute(`ALTER TABLE orders ADD COLUMN ${field.name} ${field.def}`);
                console.log(`orders table: added ${field.name}`);
            }
        }

        // fields to add to 'order_items'
        const itemFields = [
            { name: 'tax_rate', def: 'DECIMAL(10,5) DEFAULT 0.00000' },
            { name: 'tax_amount', def: 'DECIMAL(15,2) DEFAULT 0.00' }
        ];

        for (const field of itemFields) {
            const [columns] = await db.execute(`SHOW COLUMNS FROM order_items LIKE '${field.name}'`);
            if (columns.length === 0) {
                await db.execute(`ALTER TABLE order_items ADD COLUMN ${field.name} ${field.def}`);
                console.log(`order_items table: added ${field.name}`);
            }
        }

        console.log('Purchase Order Tax/Discount migration completed.');

    } catch (error) {
        console.warn('Migration for PO Tax/Discount warning:', error.message);
    }

    // --- MIGRATION FOR NULLABLE MANUAL COUNT ---
    try {
        console.log('Checking and updating products table for nullable manual_count...');
        await db.execute("ALTER TABLE products MODIFY COLUMN manual_count INT NULL DEFAULT NULL");
        console.log('Products table updated: manual_count is now nullable.');
    } catch (error) {
        console.warn('Migration for nullable manual_count warning:', error.message);
    }

    // --- MIGRATION FOR CLEARING FALSE INVENTORY HISTORY ---
    try {
        console.log('Clearing existing inventory_adjustments log and resetting manual counts...');
        // Reset manual_count to NULL for ALL products to clear any false physical count data
        await db.execute("UPDATE products SET manual_count = NULL");
        // Clear all adjustment history to fix false shrinkage reporting in P&L
        await db.execute("DELETE FROM inventory_adjustments");
        console.log('Inventory history cleared and manual counts reset to NULL successfully.');
    } catch (error) {
        console.warn('Migration for clearing inventory history warning:', error.message);
    }
}

module.exports = createTables;
