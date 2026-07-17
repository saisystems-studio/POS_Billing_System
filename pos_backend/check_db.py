import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pos_backend.settings')
django.setup()
from django.db import connection
cursor = connection.cursor()

print("=== Product_tbl columns ===")
cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Product_tbl' ORDER BY ORDINAL_POSITION")
print([row[0] for row in cursor.fetchall()])

print("=== Customer_tbl columns ===")
cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Customer_tbl' ORDER BY ORDINAL_POSITION")
print([row[0] for row in cursor.fetchall()])

print("=== Billing_tbl columns ===")
cursor.execute("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Billing_tbl' ORDER BY ORDINAL_POSITION")
print([row[0] for row in cursor.fetchall()])

print("=== All tables ===")
cursor.execute("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME")
print([row[0] for row in cursor.fetchall()])
