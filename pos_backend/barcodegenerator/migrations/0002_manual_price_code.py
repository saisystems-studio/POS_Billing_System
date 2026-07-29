from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('barcodegenerator', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='barcodegenerator',
            name='Product_Price_Code_Id',
            field=models.CharField(db_column='Product_Price_Code_Id', max_length=100),
        ),
    ]
