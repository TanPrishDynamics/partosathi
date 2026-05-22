import streamlit as st
import numpy as np
import pandas as pd
import sys
import os

# Ensure src is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.predict import predict_patient

st.set_page_config(page_title="e-Partogram AI Predictor", page_icon="👶", layout="wide")

st.title("e-Partogram AI Clinical Prediction")
st.markdown("""
This dashboard provides AI-assisted predictions for labor progression based on an LSTM architecture.
**Required input:** 10 continuous time-steps of observations.
""")

st.sidebar.header("Input Data (10 time steps)")

# For demonstration, we use a single editable dataframe
default_data = {
    "Dilation (cm)": np.linspace(2, 6, 10).round(1),
    "Contractions/10min": np.linspace(2, 4, 10).round(1),
    "FHR (bpm)": [140] * 10,
    "Pulse (bpm)": [80] * 10,
    "Systolic BP": [120] * 10,
    "Time Elapsed (hrs)": np.arange(0, 10, 1.0)
}

df = pd.DataFrame(default_data)
edited_df = st.data_editor(df, num_rows="fixed")

if st.button("Generate Clinical Prediction"):
    with st.spinner("Analyzing sequence..."):
        # Convert to expected array shape (10, 6)
        input_data = edited_df.values.tolist()
        
        result = predict_patient(input_data)
        
        if "error" in result:
            st.error(f"Prediction Error: {result['error']}")
        else:
            st.subheader("Prediction Results")
            
            col1, col2, col3 = st.columns(3)
            
            col1.metric("Expected Delivery Time", f"{result['delivery_time_hours']} hours")
            
            risk = result['risk_level']
            risk_color = "green" if risk == "Normal" else "orange" if risk == "Prolonged" else "red"
            col2.markdown(f"**Risk Level:** <span style='color:{risk_color}; font-size:20px;'>{risk}</span>", unsafe_allow_html=True)
            
            col3.metric("AI Confidence", f"{result['confidence']*100:.1f}%")
            
            if result['warnings']:
                st.warning("⚠️ " + " | ".join(result['warnings']))
                
            st.info(result['disclaimer'])
