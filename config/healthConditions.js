const healthConditions = [
  {
    id: 'gallstones',
    name: 'Gallstones',
    guidelines: 'Low-fat diet. Avoid high-fat foods, fried foods, and fatty meats. Focus on lean proteins, whole grains, fruits, and vegetables.'
  },
  {
    id: 'diabetes',
    name: 'Diabetes',
    guidelines: 'Diabetic-friendly diet. Low glycemic index foods, controlled carbohydrates, high fiber. Avoid added sugars and refined carbs.'
  },
  {
    id: 'high-blood-pressure',
    name: 'High Blood Pressure',
    guidelines: 'Heart-healthy, low-sodium diet (DASH diet). Focus on fruits, vegetables, whole grains, lean proteins. Limit sodium to under 2300mg/day.'
  },
  {
    id: 'heart-disease',
    name: 'Heart Disease',
    guidelines: 'Heart-healthy diet. Low saturated fat, high fiber, omega-3 rich foods. Focus on fruits, vegetables, whole grains, lean proteins.'
  },
  {
    id: 'obesity',
    name: 'Obesity',
    guidelines: 'Calorie-controlled, high-protein diet. Focus on lean proteins, vegetables, whole grains. Moderate portions with balanced macronutrients.'
  },
  {
    id: 'celiac',
    name: 'Celiac Disease',
    guidelines: 'Strict gluten-free diet. Avoid wheat, barley, rye, and cross-contaminated foods. Use certified gluten-free grains like rice, quinoa, corn.'
  },
  {
    id: 'ibs',
    name: 'IBS (Irritable Bowel Syndrome)',
    guidelines: 'Low-FODMAP diet. Avoid high-FODMAP foods like onions, garlic, beans, certain fruits. Focus on easily digestible foods.'
  },
  {
    id: 'kidney-disease',
    name: 'Kidney Disease',
    guidelines: 'Renal diet. Limit sodium, potassium, phosphorus. Control protein intake. Avoid processed foods and high-potassium fruits/vegetables.'
  },
  {
    id: 'gerd',
    name: 'GERD / Acid Reflux',
    guidelines: 'Avoid acidic, spicy, and fatty foods. No caffeine, alcohol, chocolate, citrus, tomatoes. Eat smaller, frequent meals.'
  },
  {
    id: 'pcos',
    name: 'PCOS',
    guidelines: 'Low glycemic, anti-inflammatory diet. Focus on whole grains, lean proteins, healthy fats. Limit refined carbs and added sugars.'
  },
  {
    id: 'hypothyroidism',
    name: 'Hypothyroidism',
    guidelines: 'Balanced diet with selenium and iodine. Limit goitrogens (raw cruciferous vegetables). Include lean proteins, whole grains, fruits.'
  },
  {
    id: 'gout',
    name: 'Gout',
    guidelines: 'Low-purine diet. Avoid organ meats, shellfish, red meat, alcohol. Focus on low-fat dairy, vegetables, whole grains. Stay hydrated.'
  }
];

function getConditionById(id) {
  return healthConditions.find(c => c.id === id || c.name.toLowerCase() === id?.toLowerCase());
}

function getGuidelinesForCondition(conditionInput) {
  if (!conditionInput) {
    return 'Balanced, nutritious diet with variety of whole foods, lean proteins, fruits, vegetables, and whole grains.';
  }
  
  const condition = getConditionById(conditionInput);
  if (condition) {
    return condition.guidelines;
  }
  
  return `Diet appropriate for ${conditionInput}. Focus on whole foods, lean proteins, fruits, vegetables, and whole grains while avoiding foods that may aggravate the condition.`;
}

function getAllConditions() {
  return healthConditions.map(c => ({ id: c.id, name: c.name }));
}

module.exports = {
  healthConditions,
  getConditionById,
  getGuidelinesForCondition,
  getAllConditions
};
