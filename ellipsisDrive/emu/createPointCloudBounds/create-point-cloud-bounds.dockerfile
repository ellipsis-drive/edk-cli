FROM nathanerkamp/python

COPY --chown=python:python requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=python:python . ./

ENTRYPOINT ["python3", "createPointCloudBounds.py"]