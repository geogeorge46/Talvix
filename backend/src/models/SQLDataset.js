import mongoose from 'mongoose';

const sqlDatasetSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    schemaDDL: { type: String, required: true }, // e.g. CREATE TABLE employees (id INT, name TEXT, salary INT);
    seedDataDML: { type: String, required: true }, // e.g. INSERT INTO employees VALUES (1, 'Alice', 90000);
    publicSampleRows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    expectedQuery: { type: String, required: true },
    tables: [
      {
        tableName: { type: String, required: true },
        columns: [
          {
            name: { type: String, required: true },
            type: { type: String, required: true },
            isPrimaryKey: { type: Boolean, default: false },
            isForeignKey: { type: Boolean, default: false },
          },
        ],
        sampleRows: { type: [mongoose.Schema.Types.Mixed], default: [] },
      },
    ],
  },
  { timestamps: true, versionKey: false }
);

export const SQLDataset = mongoose.model('SQLDataset', sqlDatasetSchema);
