import streamlit as st
import numpy as np
import pandas as pd
import sys
import os

# Add parent to path to import src
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.predict import predictor

st.set_page_config(page_title="e-Partogram Clinical Engine", page_icon="🩺")

st.title("e-Partogram Production AI Predictor")
st.markdown("""
This application uses a production-grade LSTM model to predict labor outcomes. 
Please enter 10 consecutive observations.
""")

# Input Data Entry
st.subheader("Labor Observation Sequence")
data_cols = ["Dilation (cm)", "Contractions/10m", "FHR (bpm)", "Pulse (bpm)", "Systolic BP", "Time (hrs)"]

# Default normal data
default_data = np.column_stack([
    np.linspace(4, 7, 10),
    np.full(10, 3),
    np.full(10, 145),
    np.full(10, 85),
    np.full(10, 120),
    np.arange(10)
])

df = pd.DataFrame(default_data, columns=data_cols)
edited_df = st.data_editor(df, num_rows="fixed")

if st.button("Generate Clinical Prediction"):
    with st.spinner("Analyzing physiological patterns..."):
        try:
            results = predictor.predict_patient(edited_df.values)
            
            if "error" in results:
                st.error(f"Prediction Failure: {results['error']}")
            else:
                st.success("Analysis Complete")
                
                # Layout
                m1, m2, m3 = st.columns(3)
                m1.metric("Est. Delivery Time", f"{results['delivery_time_hours']} hrs")
                
                # Risk level coloring
                risk = results['risk_level']
                color = "green" if risk == "Normal" else "orange" if risk == "Prolonged" else "red"
                m2.markdown(f"**Risk Level:** :{color}[{risk}]")
                
                m3.metric("AI Confidence", f"{results['confidence']*100:.1f}%")
                
                if results['flags']:
                    st.warning(f"⚠️ Clinical Flags: {', '.join(results['flags'])}")
                
                st.caption(f"**Disclaimer:** {results['disclaimer']}")
        except Exception as e:
            st.error(f"System Error: {str(e)}")

st.divider()
st.info("System Status: Deterministic Rule-Engine + Neural Network Hybrid Active")
